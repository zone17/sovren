-- Add updated_at triggers for all tables that have the column but no trigger.
-- The update_updated_at() function already exists from baseline_schema.sql.
-- Baseline already has triggers for: users, content, payments, comments.

-- payment_events
CREATE TRIGGER trigger_payment_events_updated_at
  BEFORE UPDATE ON payment_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- payment_retry_attempts
CREATE TRIGGER trigger_payment_retry_attempts_updated_at
  BEFORE UPDATE ON payment_retry_attempts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- webhook_events
CREATE TRIGGER trigger_webhook_events_updated_at
  BEFORE UPDATE ON webhook_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- unified_sessions
CREATE TRIGGER trigger_unified_sessions_updated_at
  BEFORE UPDATE ON unified_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- cross_posts
CREATE TRIGGER trigger_cross_posts_updated_at
  BEFORE UPDATE ON cross_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- repurposed_content
CREATE TRIGGER trigger_repurposed_content_updated_at
  BEFORE UPDATE ON repurposed_content FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- creator_circles
CREATE TRIGGER trigger_creator_circles_updated_at
  BEFORE UPDATE ON creator_circles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- service_listings
CREATE TRIGGER trigger_service_listings_updated_at
  BEFORE UPDATE ON service_listings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- contracts
CREATE TRIGGER trigger_contracts_updated_at
  BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- diversification_goals
CREATE TRIGGER trigger_diversification_goals_updated_at
  BEFORE UPDATE ON diversification_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- lightning_invoices
CREATE TRIGGER trigger_lightning_invoices_updated_at
  BEFORE UPDATE ON lightning_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- lightning_payments
CREATE TRIGGER trigger_lightning_payments_updated_at
  BEFORE UPDATE ON lightning_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- lightning_addresses
CREATE TRIGGER trigger_lightning_addresses_updated_at
  BEFORE UPDATE ON lightning_addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- lightning_webhooks
CREATE TRIGGER trigger_lightning_webhooks_updated_at
  BEFORE UPDATE ON lightning_webhooks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- user_sessions
CREATE TRIGGER trigger_user_sessions_updated_at
  BEFORE UPDATE ON user_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- user_preferences
CREATE TRIGGER trigger_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- user_wallet_providers
CREATE TRIGGER trigger_user_wallet_providers_updated_at
  BEFORE UPDATE ON user_wallet_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- user_stats
CREATE TRIGGER trigger_user_stats_updated_at
  BEFORE UPDATE ON user_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- payment_verifications
CREATE TRIGGER trigger_payment_verifications_updated_at
  BEFORE UPDATE ON payment_verifications FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- subscription_tiers
CREATE TRIGGER trigger_subscription_tiers_updated_at
  BEFORE UPDATE ON subscription_tiers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- subscriptions
CREATE TRIGGER trigger_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- recurring_payments
CREATE TRIGGER trigger_recurring_payments_updated_at
  BEFORE UPDATE ON recurring_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- nip05_verifications
CREATE TRIGGER trigger_nip05_verifications_updated_at
  BEFORE UPDATE ON nip05_verifications FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- content_items
CREATE TRIGGER trigger_content_items_updated_at
  BEFORE UPDATE ON content_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- media_assets
CREATE TRIGGER trigger_media_assets_updated_at
  BEFORE UPDATE ON media_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- content_collections
CREATE TRIGGER trigger_content_collections_updated_at
  BEFORE UPDATE ON content_collections FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- content_series
CREATE TRIGGER trigger_content_series_updated_at
  BEFORE UPDATE ON content_series FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- payouts
CREATE TRIGGER trigger_payouts_updated_at
  BEFORE UPDATE ON payouts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- payout_schedules
CREATE TRIGGER trigger_payout_schedules_updated_at
  BEFORE UPDATE ON payout_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- content_clusters
CREATE TRIGGER trigger_content_clusters_updated_at
  BEFORE UPDATE ON content_clusters FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- related_content_analytics
CREATE TRIGGER trigger_related_content_analytics_updated_at
  BEFORE UPDATE ON related_content_analytics FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- creators
CREATE TRIGGER trigger_creators_updated_at
  BEFORE UPDATE ON creators FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- creator_profiles
CREATE TRIGGER trigger_creator_profiles_updated_at
  BEFORE UPDATE ON creator_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- creator_work_patterns
CREATE TRIGGER trigger_creator_work_patterns_updated_at
  BEFORE UPDATE ON creator_work_patterns FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- creator_boundaries
CREATE TRIGGER trigger_creator_boundaries_updated_at
  BEFORE UPDATE ON creator_boundaries FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- content_fingerprints
CREATE TRIGGER trigger_content_fingerprints_updated_at
  BEFORE UPDATE ON content_fingerprints FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- content_alerts
CREATE TRIGGER trigger_content_alerts_updated_at
  BEFORE UPDATE ON content_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- auto_tagging_configs
CREATE TRIGGER trigger_auto_tagging_configs_updated_at
  BEFORE UPDATE ON auto_tagging_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- notifications (from 20260306000000_notifications.sql)
CREATE TRIGGER trigger_notifications_updated_at
  BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
