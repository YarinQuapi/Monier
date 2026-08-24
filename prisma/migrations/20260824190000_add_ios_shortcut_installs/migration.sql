-- CreateTable
CREATE TABLE `IosShortcutInstall` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `apiTokenId` VARCHAR(191) NULL,
    `file` LONGBLOB NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `IosShortcutInstall_userId_idx`(`userId`),
    INDEX `IosShortcutInstall_apiTokenId_idx`(`apiTokenId`),
    INDEX `IosShortcutInstall_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `IosShortcutInstall` ADD CONSTRAINT `IosShortcutInstall_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IosShortcutInstall` ADD CONSTRAINT `IosShortcutInstall_apiTokenId_fkey` FOREIGN KEY (`apiTokenId`) REFERENCES `ApiToken`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
