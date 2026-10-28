-- policy: owner(user_id)
CREATE TABLE notes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, body TEXT NOT NULL);
