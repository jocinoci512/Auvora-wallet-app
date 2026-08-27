-- Encrypted cross-device vault ciphertext (zero-knowledge server storage).
CREATE TABLE "encrypted_vault_blobs" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "algorithm_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "epoch" INTEGER NOT NULL DEFAULT 1,
    "kdf_salt" TEXT NOT NULL,
    "kdf_params" JSONB NOT NULL,
    "recovery_kdf_salt" TEXT NOT NULL,
    "recovery_kdf_params" JSONB NOT NULL,
    "wrapped_vault_key" TEXT NOT NULL,
    "wrapped_vault_key_recovery" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "aad" TEXT NOT NULL,
    "uploaded_by_device_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encrypted_vault_blobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "encrypted_vault_blobs_owner_user_id_key" ON "encrypted_vault_blobs"("owner_user_id");
CREATE INDEX "encrypted_vault_blobs_owner_user_id_idx" ON "encrypted_vault_blobs"("owner_user_id");

ALTER TABLE "encrypted_vault_blobs" ADD CONSTRAINT "encrypted_vault_blobs_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
