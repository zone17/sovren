-- BEGIN removed: Supabase runs each migration in an implicit transaction

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    entity_type TEXT,
    entity_id UUID,
    data JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_notification_type CHECK (type IN (
        'new_comment', 'new_follower', 'payment_received',
        'mentorship_request', 'mentorship_accepted', 'mentorship_declined',
        'circle_join', 'circle_post'
    ))
);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications (user_id) WHERE read = FALSE;

-- Realtime requires REPLICA IDENTITY FULL for UPDATE events
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- RLS policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own ON notifications
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY notifications_update_own ON notifications
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY notifications_delete_own ON notifications
    FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY notifications_insert_service ON notifications
    FOR INSERT WITH CHECK (auth.role() = 'service_role');  -- Only backend service role can insert

-- Idempotent publication for Realtime (only if supabase_realtime publication exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
        END IF;
    END IF;
END $$;

-- COMMIT removed: Supabase runs each migration in an implicit transaction
