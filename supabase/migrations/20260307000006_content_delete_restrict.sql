-- Change content.creator_id from ON DELETE CASCADE to ON DELETE RESTRICT.
-- Prevents accidental deletion of all content when a user is removed.
-- Application layer must handle content reassignment or archival before user deletion.

ALTER TABLE content DROP CONSTRAINT IF EXISTS content_creator_id_fkey;
ALTER TABLE content ADD CONSTRAINT content_creator_id_fkey
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT;
