import { Module } from "@nestjs/common";
import { ConnectorsService } from "./connectors.service";
import { ConnectorsController } from "./connectors.controller";
import { CredentialEncryptionService } from "./credential-encryption.service";
import { CredentialVaultService } from "./credential-vault.service";
import { CredentialVaultController } from "./credential-vault.controller";

@Module({
  controllers: [ConnectorsController, CredentialVaultController],
  providers: [ConnectorsService, CredentialEncryptionService, CredentialVaultService],
  exports: [ConnectorsService, CredentialVaultService],
})
export class ConnectorsModule {}