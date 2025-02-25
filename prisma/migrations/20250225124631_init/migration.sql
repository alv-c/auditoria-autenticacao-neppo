-- CreateTable
CREATE TABLE `auditoria_autenticacao_agentes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `descricao` VARCHAR(255) NULL,
    `data_json` JSON NOT NULL,
    `create_at` DATETIME NOT NULL,
    `update_at` DATETIME NULL,
    `delete_at` DATETIME NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
