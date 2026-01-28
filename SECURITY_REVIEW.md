# Molthub Security Review

**Date:** 2025-01-28
**Scope:** Full codebase review (API, Core, Adapters, Database, Web)
**Reviewer:** Security Audit Subagent

---

## Executive Summary

The Molthub codebase shows **good foundational security practices** in several areas including:
- Proper use of AWS Secrets Manager for credential storage
- Input validation using Zod and class-validator
- Webhook signature validation with timing-safe comparison
- Policy-based security enforcement
- Structured audit logging

However, there are **CRITICAL security gaps** that must be addressed before production deployment, primarily around authentication, authorization, and access control.

### Risk Rating: HIGH
**Not suitable for production without addressing critical issues.**

---

## 1. Input Validation ✅ PARTIAL

### Findings

#### Strengths
- **Zod schemas** are used for manifest validation (`packages/core/src/manifest.ts`)
- **Class-validator DTOs** are used across API endpoints with decorators like `@IsString()`, `@IsEnum()`
- Global **ValidationPipe** is configured with `whitelist: true` to strip unknown properties
- **Prisma ORM** provides parameterized queries, preventing SQL injection

#### Vulnerabilities

| Severity | Issue | Location | Details |
|----------|-------|----------|---------|
| 🔴 HIGH | `rules` field accepts `any[]` | `policy-packs.dto.ts:42` | Policy rules are typed as `any[]` without validation, allowing arbitrary object injection |
| 🔴 HIGH | `config` field in connectors accepts `Record<string, any>` | `connectors.dto.ts:16` | Connector configuration stored as untyped JSON |
| 🟡 MEDIUM | `manifestOverrides` accepts `Record<string, unknown>` | `instances.dto.ts:21` | Override objects not deeply validated |
| 🟡 MEDIUM | `targetSelector` accepts arbitrary object | `overlays.dto.ts:25` | No validation on selector structure |
| 🟡 MEDIUM | `desiredManifest` accepts `Record<string, any>` | `bot-instances.dto.ts:21` | Manifest content not validated at DTO level |

### Recommendations

1. **Replace `any[]` for policy rules** with proper validation using Zod or class-validator nested objects
2. **Validate connector configs** based on connector type (OpenAI, Slack, etc.)
3. **Add deep validation** for manifest overrides before merging
4. **Sanitize JSON inputs** to prevent prototype pollution

---

## 2. Authentication & Authorization 🔴 CRITICAL

### Findings

#### Critical Vulnerabilities

| Severity | Issue | Location | Impact |
|----------|-------|----------|--------|
| 🔴 **CRITICAL** | **No authentication implemented** | All controllers | Anyone can access/modify any resource |
| 🔴 **CRITICAL** | **No authorization guards** | All controllers | No RBAC enforcement |
| 🔴 **CRITICAL** | **Hardcoded workspace isolation** | `instances.service.ts:17` | `workspaceId: "default"` hardcoded with TODO comment |
| 🔴 **CRITICAL** | **No user context** | All services | `createdBy: "system"` hardcoded everywhere |
| 🔴 **CRITICAL** | **Resource access not verified** | All controllers | No check that user owns the resource |

#### Evidence
```typescript
// instances.service.ts
async create(dto: CreateInstanceDto): Promise<Instance> {
  const existing = await prisma.instance.findFirst({
    where: { 
      workspaceId: "default", // TODO: Get from auth context
      name: dto.name 
    },
  });
  // ...
  const instance = await prisma.instance.create({
    data: {
      workspaceId: "default", // TODO: Get from auth context
      // ...
    },
  });
}
```

```typescript
// bot-instances.service.ts
const instance = await prisma.botInstance.create({
  data: {
    // ...
    createdBy: dto.createdBy || "system", // Can spoof creator
  },
});
```

### Recommendations

1. **IMPLEMENT AUTHENTICATION IMMEDIATELY**
   - Add JWT or session-based authentication
   - Use Passport.js with NestJS guards
   - Implement `@CurrentUser()` decorator

2. **IMPLEMENT RBAC**
   ```typescript
   @UseGuards(JwtAuthGuard, RolesGuard)
   @Roles(UserRole.ADMIN)
   @Controller('bot-instances')
   ```

3. **VERIFY RESOURCE OWNERSHIP**
   - Add middleware/guard to verify workspace access
   - Check user has permission for specific resource

4. **REMOVE HARDCODED DEFAULTS**
   - Remove all `"default"` workspace IDs
   - Remove all `"system"` createdBy fallbacks

---

## 3. Secrets Management 🟡 MODERATE

### Findings

#### Strengths
- AWS Secrets Manager properly used for instance secrets
- Secret ARNs used in ECS task definitions (not values)
- Webhook validation uses timing-safe comparison (`timingSafeEqual`)
- Secret generation uses cryptographically secure random

#### Vulnerabilities

| Severity | Issue | Location | Details |
|----------|-------|----------|---------|
| 🔴 HIGH | Connector configs stored in plain JSON | `connectors.service.ts:12` | API keys, tokens stored in database unencrypted |
| 🟡 MEDIUM | No secret rotation tracking | `secrets-service.ts` | Rotation schedule exists but no automated rotation |
| 🟡 MEDIUM | Secret values logged | Potential risk | Error messages may include sensitive data |
| 🟢 LOW | Secrets in env vars | `.env.example` | AWS credentials in env (acceptable for ECS task role) |

### Recommendations

1. **Encrypt connector configs at rest**
   ```typescript
   // Use AWS KMS or similar
   config: encrypt(JSON.stringify(dto.config))
   ```

2. **Implement automated secret rotation**
   - Add rotation logic to `CredentialRotation` model
   - Integrate with AWS Secrets Manager rotation

3. **Sanitize error messages**
   - Ensure secrets are never included in error responses
   - Add logging filters for sensitive fields

---

## 4. API Security 🔴 CRITICAL

### Findings

#### Vulnerabilities

| Severity | Issue | Location | Details |
|----------|-------|----------|---------|
| 🔴 **CRITICAL** | **No rate limiting** | `main.ts` | Susceptible to brute force, DoS |
| 🔴 **CRITICAL** | **No request size limits** | `main.ts` | Could crash with large payloads |
| 🟡 MEDIUM | CORS allows credentials with dynamic origin | `main.ts:13` | Potential security risk if origin validation is weak |
| 🟡 MEDIUM | No CSRF protection | All state-changing endpoints | Cross-site request forgery possible |
| 🟡 MEDIUM | No security headers | `main.ts` | Missing Helmet, CSP, HSTS |
| 🟡 MEDIUM | Swagger docs expose API structure | `main.ts:22` | Information disclosure in production |

#### Evidence
```typescript
// main.ts - No security middleware
app.enableCors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,  // Risky with dynamic origin
});
// No rate limiting
// No request limits
// No Helmet
```

### Recommendations

1. **Add rate limiting**
   ```typescript
   import { ThrottlerModule } from '@nestjs/throttler';
   
   ThrottlerModule.forRoot({
     ttl: 60,
     limit: 100,
   })
   ```

2. **Add request size limits**
   ```typescript
   app.use(express.json({ limit: '10mb' }));
   ```

3. **Install security headers**
   ```typescript
   import helmet from 'helmet';
   app.use(helmet());
   ```

4. **Disable Swagger in production**
   ```typescript
   if (process.env.NODE_ENV !== 'production') {
     SwaggerModule.setup("api/docs", app, document);
   }
   ```

5. **Add CSRF protection** for non-API routes if applicable

---

## 5. Policy Enforcement ✅ MOSTLY GOOD

### Findings

#### Strengths
- Comprehensive policy engine with multiple rule types
- Built-in security policy packs (Security Baseline, Production Guardrails)
- Validation for forbidden fields, required fields, image pinning
- Discriminated unions for rule configuration types

#### Vulnerabilities

| Severity | Issue | Location | Details |
|----------|-------|----------|---------|
| 🟡 MEDIUM | Policy rules can be bypassed | `policy-packs.service.ts` | Rules stored as JSON, validation only on create |
| 🟡 MEDIUM | No policy versioning/migration | `policy-pack.ts` | Changes to policy schema could break existing rules |
| 🟢 LOW | Custom JSON Schema not validated | `policy-pack.ts:127` | Custom schemas could be malicious |

### Recommendations

1. **Validate rules on evaluation**, not just creation
2. **Add policy versioning** and migration system
3. **Sanitize custom JSON schemas** to prevent ReDoS attacks

---

## 6. Infrastructure Security ✅ GOOD

### Findings

#### Strengths
- ECS Fargate with awsvpc networking mode
- Private subnets used (no public IP assignment)
- Security groups referenced
- Task roles separate from execution roles
- CloudWatch log groups with proper tagging

#### Vulnerabilities

| Severity | Issue | Location | Details |
|----------|-------|----------|---------|
| 🟡 MEDIUM | No egress restrictions in code | `ecs-service.ts` | Egress preset configurable but not enforced |
| 🟡 MEDIUM | No resource tagging validation | `ecs-service.ts` | Tags could contain sensitive data |
| 🟢 LOW | Environment variables for infra config | `ecs-service.ts` | Could use AWS Systems Manager Parameter Store |

### Recommendations

1. **Enforce egress restrictions** via security groups
2. **Validate resource tags** for sensitive content
3. **Use Parameter Store** for infrastructure configuration

---

## 7. Data Protection 🟡 MODERATE

### Findings

#### Vulnerabilities

| Severity | Issue | Location | Details |
|----------|-------|----------|---------|
| 🔴 HIGH | Traces store input/output | `traces.service.ts:12` | Could contain PII, secrets, sensitive data |
| 🔴 HIGH | No data retention policies | Database schema | Data kept indefinitely |
| 🟡 MEDIUM | Audit logs don't validate actor | `audit.service.ts:16` | Actor ID not verified against auth |
| 🟡 MEDIUM | No encryption at rest config | `schema.prisma` | Relies on RDS default encryption |
| 🟡 MEDIUM | Error details exposed | Various | Stack traces may leak in API responses |

### Recommendations

1. **Implement data retention policies**
   ```typescript
   // Auto-delete old traces
   await prisma.trace.deleteMany({
     where: { startedAt: { lt: retentionCutoff } }
   });
   ```

2. **Sanitize trace data**
   - Redact known sensitive fields (passwords, tokens)
   - Hash PII fields

3. **Enable database encryption at rest** (if not already)

4. **Sanitize error responses** in production
   ```typescript
   app.useGlobalFilters(new AllExceptionsFilter());
   ```

---

## 8. Additional Security Concerns

### Webhook Security ✅ GOOD
The webhook validation service properly implements:
- HMAC-SHA256 signature validation
- Timing-safe comparison (`timingSafeEqual`)
- Timestamp validation for replay protection (Slack)
- Support for multiple signature formats

### Audit Logging 🟡 PARTIAL
- Good: Structured audit events with actor, action, resource
- Good: Relations to change sets for tracking
- Bad: No authentication means actor is not verified
- Bad: Limited metadata (no IP, user agent)

### Dependency Security
```bash
# No evidence of:
- npm audit in CI
- Dependabot configuration
- SBOM generation
```

---

## Critical Issues Summary (Must Fix Before Production)

| # | Issue | Priority | Effort |
|---|-------|----------|--------|
| 1 | **Implement authentication** | CRITICAL | Medium |
| 2 | **Implement authorization/RBAC** | CRITICAL | Medium |
| 3 | **Add rate limiting** | CRITICAL | Low |
| 4 | **Add request size limits** | CRITICAL | Low |
| 5 | **Remove hardcoded workspace IDs** | CRITICAL | Low |
| 6 | **Encrypt connector configs** | HIGH | Medium |
| 7 | **Add data retention** | HIGH | Low |
| 8 | **Sanitize trace data** | HIGH | Medium |

---

## Security Recommendations by Priority

### Immediate (Pre-Production)

1. **Authentication & Authorization**
   ```typescript
   // Example implementation
   @Module({
     imports: [
       PassportModule.register({ defaultStrategy: 'jwt' }),
       JwtModule.register({
         secret: process.env.JWT_SECRET,
         signOptions: { expiresIn: '1h' },
       }),
     ],
   })
   ```

2. **API Security Middleware**
   ```typescript
   app.use(helmet());
   app.use(compression());
   app.use(express.json({ limit: '10mb' }));
   ```

3. **Rate Limiting**
   ```typescript
   @Module({
     imports: [
       ThrottlerModule.forRoot({
         ttl: 60,
         limit: 100,
       }),
     ],
   })
   ```

### Short-term (Post-Launch)

1. Implement automated secret rotation
2. Add data retention policies with automated cleanup
3. Implement dependency scanning in CI/CD
4. Add security headers and CSP
5. Implement request signing for internal services

### Long-term

1. Implement mTLS for service-to-service communication
2. Add runtime application self-protection (RASP)
3. Implement security event monitoring and alerting
4. Regular penetration testing
5. Bug bounty program

---

## Compliance Considerations

| Requirement | Status | Notes |
|-------------|--------|-------|
| SOC 2 Type II | ❌ Not ready | Missing auth, access controls |
| GDPR | ❌ Not ready | No data retention, PII handling |
| HIPAA | ❌ Not ready | No encryption at rest guarantees |
| PCI DSS | N/A | Not handling payment data |

---

## Appendix: Secure Configuration Checklist

### Environment Variables
- [ ] `JWT_SECRET` - Strong random string (32+ chars)
- [ ] `ENCRYPTION_KEY` - For connector config encryption
- [ ] `DATABASE_URL` - Use IAM auth or Secrets Manager
- [ ] `AWS_REGION` - Validate against allowed regions
- [ ] `FRONTEND_URL` - Strict origin validation

### Database
- [ ] Enable encryption at rest
- [ ] Enable SSL/TLS for connections
- [ ] Implement connection pooling limits
- [ ] Enable query logging (audit)

### AWS Infrastructure
- [ ] Use least-privilege IAM roles
- [ ] Enable VPC Flow Logs
- [ ] Enable CloudTrail for API auditing
- [ ] Enable GuardDuty for threat detection
- [ ] Configure AWS Config for compliance monitoring

---

## Conclusion

Molthub has a solid foundation with good security patterns in several areas, particularly around secrets management, policy enforcement, and infrastructure configuration. However, **the complete absence of authentication and authorization makes it unsuitable for production use**.

The development team should prioritize implementing authentication, authorization, and basic API security controls before any production deployment. The remaining issues can be addressed in subsequent releases.

**Estimated time to production-ready security: 2-3 weeks** (focusing on critical issues only)
