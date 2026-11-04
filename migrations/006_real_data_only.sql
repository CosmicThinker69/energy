-- These legacy views depended on synthetic settlement/capture/volatility fields.
-- Keep their metadata for administration, but remove them from customer access.
UPDATE portal.dashboards SET enabled=false,updated_at=now()
 WHERE viewer_type='native' AND native_key IN ('balancing','intelligence');
UPDATE portal.dashboards SET badge='ENTSO-E',updated_at=now()
 WHERE slug='entsoe-energy' AND viewer_type='streamlit';
UPDATE portal.dashboards SET description='Published day-ahead electricity prices across European bidding zones.',updated_at=now()
 WHERE viewer_type='native' AND native_key='day-ahead';
UPDATE portal.dashboards SET description='Observed negative-price intervals and duration, with provider coverage.',updated_at=now()
 WHERE viewer_type='native' AND native_key='negative-prices';
UPDATE portal.dashboards SET description='Reported scheduled electricity imports and exports by market.',updated_at=now()
 WHERE viewer_type='native' AND native_key='cross-border';
UPDATE portal.dashboards SET description='Published electricity prices and reported generation for Bulgaria.',updated_at=now()
 WHERE viewer_type='native' AND native_key='country';
