-- Add DEBIT_CARD as a PaymentMethod type (behaves like a bank account for
-- cash-outflow purposes: charged immediately, no billing cycle).
ALTER TABLE `PaymentMethod` MODIFY `type` ENUM('CREDIT_CARD', 'DEBIT_CARD', 'BANK_ACCOUNT') NOT NULL;

-- Add ONGOING_ANNUAL as a Subscription billing type (recurs every 12
-- months on billingDayOfMonth, anchored to startDate's calendar month).
ALTER TABLE `Subscription` MODIFY `billingType` ENUM('ONGOING_MONTHLY', 'ONGOING_ANNUAL', 'FIXED_TERM') NOT NULL;
