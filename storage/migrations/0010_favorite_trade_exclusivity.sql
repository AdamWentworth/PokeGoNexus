UPDATE instances
SET is_for_trade = 0
WHERE favorite = 1 AND is_for_trade = 1;

ALTER TABLE instances
    ADD CONSTRAINT chk_instances_favorite_not_for_trade
    CHECK (NOT (favorite = 1 AND is_for_trade = 1));
