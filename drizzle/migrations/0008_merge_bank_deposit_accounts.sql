-- One deposit account per bank, matching bankAccountFromSms.
--
-- Until now a bank SMS was keyed by whatever digits it carried, and the same
-- savings account carries several: the debit card on purchases (T.Deb *1111),
-- a second or virtual card (*2222), the account itself on transfers and QR
-- payments (cuenta *9999), and nothing at all on some incoming payments. Each
-- became its own account. This folds every non-credit account of a bank into
-- one, keyed by mask '' and named after the bank. Credit cards stay apart.
--
-- Data only, no schema change. Every step is safe to run twice.

-- 1. A credit card whose messages named no digits was keyed '' too, which is
--    now the deposit account's key. Give it the stand-in the code uses.
UPDATE accounts
SET mask = 'TC'
WHERE bank IS NOT NULL AND type = 'credit_card' AND mask = '';
--> statement-breakpoint

-- 2. Move the transactions. The account kept per (user, bank) is the one
--    already keyed '' if there is one, else the oldest.
WITH keep AS (
  SELECT DISTINCT ON (user_id, bank) user_id, bank, id AS keep_id
  FROM accounts
  WHERE bank IS NOT NULL AND type <> 'credit_card'
  ORDER BY user_id, bank, (mask = '') DESC, created_at, id
),
merge AS (
  SELECT a.id AS from_id, k.keep_id
  FROM accounts a
  JOIN keep k ON k.user_id = a.user_id AND k.bank = a.bank
  WHERE a.type <> 'credit_card' AND a.id <> k.keep_id
)
UPDATE transactions t
SET account_id = m.keep_id
FROM merge m
WHERE t.account_id = m.from_id;
--> statement-breakpoint

-- 3. Carry any initial balance over, then drop the emptied accounts. One
--    statement, so a rerun cannot add a balance twice. The transactions were
--    moved above, so the ON DELETE SET NULL on transactions finds none.
WITH keep AS (
  SELECT DISTINCT ON (user_id, bank) user_id, bank, id AS keep_id
  FROM accounts
  WHERE bank IS NOT NULL AND type <> 'credit_card'
  ORDER BY user_id, bank, (mask = '') DESC, created_at, id
),
merge AS (
  SELECT a.id AS from_id, k.keep_id, a.initial_balance_minor
  FROM accounts a
  JOIN keep k ON k.user_id = a.user_id AND k.bank = a.bank
  WHERE a.type <> 'credit_card' AND a.id <> k.keep_id
),
carried AS (
  UPDATE accounts a
  SET initial_balance_minor = a.initial_balance_minor + s.total
  FROM (
    SELECT keep_id, SUM(initial_balance_minor) AS total FROM merge GROUP BY keep_id
  ) s
  WHERE a.id = s.keep_id AND s.total <> 0
  RETURNING a.id
)
DELETE FROM accounts a
USING merge m
WHERE a.id = m.from_id;
--> statement-breakpoint

-- 4. Key the survivor '' so the next message finds it.
UPDATE accounts
SET mask = ''
WHERE bank IS NOT NULL AND type <> 'credit_card' AND mask <> '';
--> statement-breakpoint

-- 5. Name it after the bank: "Bancolombia *1111" named one card, not the
--    account. Skipped where the person already has an account by that name.
UPDATE accounts a
SET name = CASE a.bank WHEN 'bancolombia' THEN 'Bancolombia' WHEN 'banco_bogota' THEN 'Banco de Bogotá' END
WHERE a.bank IN ('bancolombia', 'banco_bogota')
  AND a.type <> 'credit_card'
  AND a.name <> CASE a.bank WHEN 'bancolombia' THEN 'Bancolombia' WHEN 'banco_bogota' THEN 'Banco de Bogotá' END
  AND NOT EXISTS (
    SELECT 1 FROM accounts o
    WHERE o.user_id = a.user_id
      AND o.id <> a.id
      AND o.name = CASE a.bank WHEN 'bancolombia' THEN 'Bancolombia' WHEN 'banco_bogota' THEN 'Banco de Bogotá' END
  );
--> statement-breakpoint

-- 6. Credit cards read as credit cards: "Bancolombia *4444" becomes
--    "Bancolombia Crédito *4444", the name new messages now give them.
UPDATE accounts a
SET name = CASE a.bank WHEN 'bancolombia' THEN 'Bancolombia' WHEN 'banco_bogota' THEN 'Banco de Bogotá' END
  || ' Crédito' || CASE WHEN a.mask = 'TC' THEN '' ELSE ' *' || a.mask END
WHERE a.bank IN ('bancolombia', 'banco_bogota')
  AND a.type = 'credit_card'
  AND a.name NOT LIKE '% Crédito%'
  AND NOT EXISTS (
    SELECT 1 FROM accounts o
    WHERE o.user_id = a.user_id
      AND o.id <> a.id
      AND o.name = CASE a.bank WHEN 'bancolombia' THEN 'Bancolombia' WHEN 'banco_bogota' THEN 'Banco de Bogotá' END
        || ' Crédito' || CASE WHEN a.mask = 'TC' THEN '' ELSE ' *' || a.mask END
  );
