-- One-time cleanup (docs/plans/home-feed.md section 20, D-066).
-- A first answer to "What do you shop for?" forgets the category taste learned in the other groups (section 18.3).
-- People who answered before that rule went live on 2026-11-27 never had it run, so their Home still led with a
-- group they said is not theirs. This does for them once what a first answer does now: it deletes the category and
-- parent category taste lines that sit under Women, Men or Kids when the person did not pick that group.
-- Brands, sellers, sizes and every other line stay. People without an answer are not touched.
-- It deletes data and cannot be undone. Running it again deletes nothing new except corners opened since.
DELETE FROM "user_affinities" AS ua
USING "user_settings" AS us, "categories" AS c
WHERE us."user_id" = ua."user_id"
  AND cardinality(us."shops_for") > 0
  AND ua."feature" IN ('category', 'parent_category')
  AND c."id"::text = ua."feature_key"
  AND split_part(c."path", '/', 1) IN ('women', 'men', 'kids')
  AND split_part(c."path", '/', 1) <> ALL (us."shops_for");
