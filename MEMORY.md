# MEMORY.md - Long-Term Memory

*This file is only loaded in private sessions (not in group chats).*

## 📋 Quick Access Links

### 🎯 Internal Guides
- **Obsidian Writing Guide**: `obsidian/Guides/Obsidian Writing Guide.md`
  - How to create efficient Obsidian docs
  - Template patterns
  - Linking strategies
  - Maintenance workflow
  - *Always check this before writing new pages!*

### 👥 Users
- **Tomer (Bobby Blast)**: `memory/2026-01-26.md`
  - Telegram ID: 7215456983
  - Timezone: Israel (UTC+2/+3)
  - Role: Software Engineer at Wix
  - GitHub: github.com/tomer-shavit
  - Obsidian Knowledge Base: `obsidian/`
  - *Language: Speaks Hebrew and English*
  - **AI Startup:** Privacy-first migration service from proprietary LLMs → open-source
  - **Goal:** ~80% AI spend reduction without quality/UX drop
  - **Working style:** Product engineer, skeptical, forcing-function clarity
  - **ML prefs:** Real mechanics, explicit equations, 𝜆 for regularization

---

## 🛠️ Configuration & Setup

### External Services
- **Brave Search API**: Configured and working
  - Key: `BSAoZucbLrwTcazyG6xMoaUEyNwYfZq`
  - Used for web_search tool
  - Date configured: 2026-01-26

### Workspace Structure
```
/home/ubuntu/clawd/
├── obsidian/          ← Tomer's knowledge base
├── memory/            ← Daily logs
└── MEMORY.md          ← This file
```

---

## 💡 Patterns & Decisions

### Memory System
- **Daily logs**: `memory/YYYY-MM-DD.md` - Raw notes of what happened
- **Long-term**: `MEMORY.md` - Curated, distilled wisdom
- **Rule**: "Text > Brain" - Files persist between sessions

### Obsidian Integration
- Tomer uses Obsidian for knowledge management
- Clawdbot can create/update Obsidian-style markdown files
- Wikilinks `[[Page]]` enable bidirectional connections
- Graph view shows knowledge relationships

### Notion Integration (Interest)
- Tomer wants to connect Clawdbot to Notion
- Notion skill is available at `skills/notion/SKILL.md`
- Can create/read/update pages, data sources (databases), and blocks
- Setup requires: Notion API integration + key at `~/.config/notion/api_key`
- Can sync between Obsidian and Notion systems
- Status: Not yet connected, created `obsidian/Tools/Notion.md` documentation

### Language Preference
- Tomer speaks Hebrew and English
- Can respond in either language
- Ask or infer based on context

---

## 📚 Important Knowledge

### Tomer's Tech Stack
- **Languages**: Scala, Golang, JavaScript, TypeScript, Python, C, C++, Java
- **Frameworks**: React, Next.js, Node.js, Flask, Redux, Tailwind
- **Infrastructure**: AWS (EC2, S3, SQS, SES), Azure (Serverless, Application Insights), Docker, Kubernetes
- **Databases**: MongoDB, Redis, SQL
- **Tools**: Kafka, Grafana, Git

### Tomer's Achievements
- 3x Hackathon Champion (HUJI-ASPER, Hebrew University, International Sick Solutions)
- CVBoost: AI-driven resume analysis tool (full-stack)
- Featured prominently on LinkedIn

---

## 🔄 Maintenance Tasks

### When Tomer's Situation Changes
- New job → Update `obsidian/Work/` + `obsidian/People/Tomer Shavit.md`
- New project → Create `obsidian/Projects/Name.md` + link to skills
- New skill → Update `obsidian/Skills/Skills Overview.md`
- Major achievement → Update `obsidian/Projects/Hackathon Wins.md`

### Weekly Obsidian Maintenance
- [ ] Check for orphan pages
- [ ] Update daily notes
- [ ] Consolidate duplicates
- [ ] Update tags

---

## 📝 Notes to Self

### Before Writing Obsidian Docs
1. **READ THE GUIDE**: `obsidian/Guides/Obsidian Writing Guide.md`
2. Check if page already exists (read first!)
3. Use appropriate template
4. Create wikilinks to all related pages
5. Apply frontmatter consistently

### When User Asks for Help
- Search memory first: Use `memory_search` tool
- Use `memory_get` to pull only needed lines (keeps context small)
- If no relevant info found, write new memory entry

### Efficiency Principles
- Be resourceful before asking
- Try to figure it out first
- Read files, check context, search web
- Then ask if stuck
- Earn trust through competence

---

*Last updated: 2026-01-26*
