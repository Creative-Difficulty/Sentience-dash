import { pgTable, index, foreignKey, uuid, bigint, timestamp, text, unique, boolean, check, vector, integer, jsonb, doublePrecision, real, smallint, pgEnum, vector } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const activityRecordType = pgEnum("activity_record_type", ['activity', 'fact', 'skill', 'emotion'])
export const activitySource = pgEnum("activity_source", ['llm_extraction', 'external_content', 'manual'])
export const discordChannelType = pgEnum("discord_channel_type", ['text', 'text_thread', 'forum_post', 'voice', 'forum', 'stage', 'category', 'public_thread'])
export const jobStatus = pgEnum("job_status", ['pending', 'in_progress', 'completed', 'failed'])
export const jobType = pgEnum("job_type", ['youtube_channel_retrieval', 'discord_channel_sync', 'strava_retrieval', 'linkedin_scrape'])
export const platformAccess = pgEnum("platform_access", ['public', 'oauth_required', 'unavailable'])
export const presenceStatus = pgEnum("presence_status", ['online', 'forced_online', 'absent', 'do_not_disturb', 'offline'])
export const youtubeVideoBroadcastStatus = pgEnum("youtube_video_broadcast_status", ['video', 'current_live', 'past_live', 'scheduled_live', 'none'])


export const messageAttachments = pgTable("message_attachments", {
    id: uuid().defaultRandom().primaryKey().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    messageId: bigint("message_id", { mode: "number" }).notNull(),
    assetId: uuid("asset_id").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
    index("idx_message_attachments_active").using("btree", table.messageId.asc().nullsLast().op("int8_ops")).where(sql`(deleted_at IS NULL)`),
    index("idx_message_attachments_asset_id").using("btree", table.assetId.asc().nullsLast().op("uuid_ops")),
    foreignKey({
        columns: [table.assetId],
        foreignColumns: [mediaAssets.id],
        name: "message_attachments_asset_id_fkey"
    }).onDelete("restrict"),
    foreignKey({
        columns: [table.messageId],
        foreignColumns: [messages.messageId],
        name: "message_attachments_message_id_fkey"
    }).onDelete("cascade"),
]);

export const vestibuleUsers = pgTable("vestibule_users", {
    id: uuid().defaultRandom().primaryKey().notNull(),
    nickname: text(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    introMessageId: bigint("intro_message_id", { mode: "number" }),
    scoreId: uuid("score_id"),
    scoreLastUpdated: timestamp("score_last_updated", { withTimezone: true, mode: 'string' }),
    // TODO: failed to parse database type 'bytea'
    currentDiagram: vector("current_diagram", { dimensions: 1536 }),
    currentDiagramLastUpdated: timestamp("current_diagram_last_updated", { withTimezone: true, mode: 'string' }),
    // TODO: failed to parse database type 'bytea'
    introDiagram: vector("intro_diagram", { dimensions: 1536 }),
}, (table) => [
    foreignKey({
        columns: [table.introMessageId],
        foreignColumns: [messages.messageId],
        name: "fk_vestibule_users_intro_message"
    }),
    foreignKey({
        columns: [table.scoreId],
        foreignColumns: [scores.id],
        name: "vestibule_users_score_id_fkey"
    }),
]);

export const discordAccounts = pgTable("discord_accounts", {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    discordUserId: bigint("discord_user_id", { mode: "number" }).primaryKey().notNull(),
    vestibuleUserId: uuid("vestibule_user_id").notNull(),
    username: text().notNull(),
    displayName: text("display_name").notNull(),
}, (table) => [
    index("idx_discord_accounts_user").using("btree", table.vestibuleUserId.asc().nullsLast().op("uuid_ops")),
    foreignKey({
        columns: [table.vestibuleUserId],
        foreignColumns: [vestibuleUsers.id],
        name: "discord_accounts_vestibule_user_id_fkey"
    }).onDelete("cascade"),
    unique("discord_accounts_username_key").on(table.username),
]);

export const discordEmojis = pgTable("discord_emojis", {
    id: uuid().defaultRandom().primaryKey().notNull(),
    discordEmojiId: text("discord_emoji_id").notNull(),
    fromGuild: text("from_guild"),
    emojiDisplayName: text("emoji_display_name"),
    isAnimated: boolean("is_animated").default(false).notNull(),
    emojiUrl: text("emoji_url"),
    assetId: uuid("asset_id"),
}, (table) => [
    foreignKey({
        columns: [table.assetId],
        foreignColumns: [mediaAssets.id],
        name: "discord_emojis_asset_id_fkey"
    }),
]);

export const messageReactions = pgTable("message_reactions", {
    id: uuid().defaultRandom().primaryKey().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    messageId: bigint("message_id", { mode: "number" }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    userId: bigint("user_id", { mode: "number" }).notNull(),
    emojiId: uuid("emoji_id"),
    reactedAt: timestamp("reacted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
    index("idx_message_reactions_message").using("btree", table.messageId.asc().nullsLast().op("int8_ops")),
    index("idx_message_reactions_user").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
    foreignKey({
        columns: [table.emojiId],
        foreignColumns: [discordEmojis.id],
        name: "message_reactions_emoji_id_fkey"
    }).onDelete("restrict"),
    foreignKey({
        columns: [table.messageId],
        foreignColumns: [messages.messageId],
        name: "message_reactions_message_id_fkey"
    }).onDelete("cascade"),
    foreignKey({
        columns: [table.userId],
        foreignColumns: [discordAccounts.discordUserId],
        name: "message_reactions_user_id_fkey"
    }),
    unique("message_reactions_message_id_user_id_emoji_id_key").on(table.messageId, table.userId, table.emojiId),
]);

export const socialPlatforms = pgTable("social_platforms", {
    id: uuid().primaryKey().notNull(),
    platformName: text("platform_name").notNull(),
    homepage: text().notNull(),
    accessType: platformAccess("access_type").notNull(),
    logo: uuid(),
}, (table) => [
    foreignKey({
        columns: [table.logo],
        foreignColumns: [mediaAssets.id],
        name: "social_platforms_logo_fkey"
    }),
    unique("social_platforms_platform_name_key").on(table.platformName),
]);

export const discordUserPresence = pgTable("discord_user_presence", {
    id: uuid().defaultRandom().primaryKey().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    userId: bigint("user_id", { mode: "number" }).notNull(),
    status: presenceStatus(),
    activityType: text("activity_type"),
    name: text(),
    details: text(),
    state: text(),
    url: text(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: 'string' }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    evidenceMessageId: bigint("evidence_message_id", { mode: "number" }),
}, (table) => [
    index("idx_presence_current_activity").using("btree", table.userId.asc().nullsLast().op("int8_ops")).where(sql`((ended_at IS NULL) AND (activity_type IS NOT NULL))`),
    index("idx_presence_current_status").using("btree", table.userId.asc().nullsLast().op("int8_ops")).where(sql`((ended_at IS NULL) AND (status IS NOT NULL))`),
    index("idx_presence_history").using("btree", table.userId.asc().nullsLast().op("int8_ops"), table.startedAt.asc().nullsLast().op("int8_ops"), table.endedAt.asc().nullsLast().op("int8_ops")),
    index("idx_presence_time").using("btree", table.startedAt.desc().nullsFirst().op("timestamptz_ops")),
    foreignKey({
        columns: [table.evidenceMessageId],
        foreignColumns: [messages.messageId],
        name: "discord_user_presence_evidence_message_id_fkey"
    }).onDelete("cascade"),
    foreignKey({
        columns: [table.userId],
        foreignColumns: [discordAccounts.discordUserId],
        name: "discord_user_presence_user_id_fkey"
    }).onDelete("cascade"),
    check("discord_user_presence_check", sql`(evidence_message_id IS NULL) OR (status = 'forced_online'::presence_status)`),
    check("valid_presence_range", sql`(ended_at IS NULL) OR (ended_at > started_at)`),
]);

export const connectedAccounts = pgTable("connected_accounts", {
    id: uuid().defaultRandom().primaryKey().notNull(),
    vestibuleUserId: uuid("vestibule_user_id").notNull(),
    platformId: uuid("platform_id").notNull(),
    platformUserId: text("platform_user_id"),
    platformDisplayName: text("platform_display_name").notNull(),
    platformUsername: text("platform_username").notNull(),
    bio: text(),
    bioAdditionalInfo: text("bio_additional_info"),
    profilePicture: uuid("profile_picture"),
    //TODO
    nameEmbedding: vector("name_embedding", { dimensions: 1536 }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    mentionMessageId: bigint("mention_message_id", { mode: "number" }),
    reasoning: text().notNull(),
}, (table) => [
    index("idx_connected_accounts_user_id").using("btree", table.vestibuleUserId.asc().nullsLast().op("uuid_ops")),
    foreignKey({
        columns: [table.mentionMessageId],
        foreignColumns: [messages.messageId],
        name: "connected_accounts_mention_message_id_fkey"
    }),
    foreignKey({
        columns: [table.platformId],
        foreignColumns: [socialPlatforms.id],
        name: "connected_accounts_platform_id_fkey"
    }),
    foreignKey({
        columns: [table.profilePicture],
        foreignColumns: [mediaAssets.id],
        name: "connected_accounts_profile_picture_fkey"
    }),
    foreignKey({
        columns: [table.vestibuleUserId],
        foreignColumns: [vestibuleUsers.id],
        name: "connected_accounts_vestibule_user_id_fkey"
    }).onDelete("cascade"),
    unique("connected_accounts_vestibule_user_id_platform_id_platform_u_key").on(table.vestibuleUserId, table.platformId, table.platformUsername),
    check("connected_accounts_check", sql`(mention_message_id IS NOT NULL) OR (reasoning IS NOT NULL)`),
]);

export const youtubeVideos = pgTable("youtube_videos", {
    videoId: text("video_id").primaryKey().notNull(),
    channelVestibuleId: uuid("channel_vestibule_id").notNull(),
    title: text().notNull(),
    description: text(),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    totalViews: bigint("total_views", { mode: "number" }).default(0).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    totalLikes: bigint("total_likes", { mode: "number" }).default(0).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    totalComments: bigint("total_comments", { mode: "number" }).default(0).notNull(),
    keywordTags: text("keyword_tags").array(),
    durationSeconds: integer("duration_seconds").notNull(),
    broadcastStatus: youtubeVideoBroadcastStatus("broadcast_status").notNull(),
    thumbnailAssetId: uuid("thumbnail_asset_id"),
    transcriptAssetId: uuid("transcript_asset_id"),
    audioAssetId: uuid("audio_asset_id"),
    addedAt: timestamp("added_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
    foreignKey({
        columns: [table.audioAssetId],
        foreignColumns: [mediaAssets.id],
        name: "youtube_videos_audio_asset_id_fkey"
    }),
    foreignKey({
        columns: [table.channelVestibuleId],
        foreignColumns: [connectedAccounts.id],
        name: "youtube_videos_channel_vestibule_id_fkey"
    }).onDelete("cascade"),
    foreignKey({
        columns: [table.thumbnailAssetId],
        foreignColumns: [mediaAssets.id],
        name: "youtube_videos_thumbnail_asset_id_fkey"
    }),
    foreignKey({
        columns: [table.transcriptAssetId],
        foreignColumns: [mediaAssets.id],
        name: "youtube_videos_transcript_asset_id_fkey"
    }),
]);

export const youtubeComments = pgTable("youtube_comments", {
    commentId: text("comment_id").primaryKey().notNull(),
    videoId: text("video_id").notNull(),
    authorRawChannelId: text("author_raw_channel_id").notNull(),
    authorChannelId: uuid("author_channel_id"),
    content: text().notNull(),
    likeCount: integer("like_count").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }).notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true, mode: 'string' }),
    inReplyTo: text("in_reply_to"),
    addedAt: timestamp("added_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
    index("idx_youtube_comments_author").using("btree", table.authorChannelId.asc().nullsLast().op("uuid_ops")),
    index("idx_youtube_comments_published").using("btree", table.publishedAt.desc().nullsFirst().op("timestamptz_ops")),
    index("idx_youtube_comments_video").using("btree", table.videoId.asc().nullsLast().op("text_ops")),
    foreignKey({
        columns: [table.authorChannelId],
        foreignColumns: [connectedAccounts.id],
        name: "youtube_comments_author_channel_id_fkey"
    }).onDelete("cascade"),
    foreignKey({
        columns: [table.inReplyTo],
        foreignColumns: [table.commentId],
        name: "youtube_comments_in_reply_to_fkey"
    }),
    foreignKey({
        columns: [table.videoId],
        foreignColumns: [youtubeVideos.videoId],
        name: "youtube_comments_video_id_fkey"
    }).onDelete("cascade"),
]);

export const jobs = pgTable("jobs", {
    id: uuid().defaultRandom().primaryKey().notNull(),
    jobType: jobType("job_type").notNull(),
    status: jobStatus().default('pending').notNull(),
    lockedByWorkerId: text("locked_by_worker_id"),
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: 'string' }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    attempts: integer().default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    lastError: text("last_error"),
    youtubeVideoId: text("youtube_video_id"),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    discordChannelId: bigint("discord_channel_id", { mode: "number" }),
    connectedAccountId: uuid("connected_account_id"),
    mediaAssetId: uuid("media_asset_id"),
}, (table) => [
    foreignKey({
        columns: [table.connectedAccountId],
        foreignColumns: [connectedAccounts.id],
        name: "jobs_connected_account_id_fkey"
    }).onDelete("cascade"),
    foreignKey({
        columns: [table.discordChannelId],
        foreignColumns: [discordChannels.channelId],
        name: "jobs_discord_channel_id_fkey"
    }).onDelete("cascade"),
    foreignKey({
        columns: [table.mediaAssetId],
        foreignColumns: [mediaAssets.id],
        name: "jobs_media_asset_id_fkey"
    }).onDelete("cascade"),
    foreignKey({
        columns: [table.youtubeVideoId],
        foreignColumns: [youtubeVideos.videoId],
        name: "jobs_youtube_video_id_fkey"
    }).onDelete("cascade"),
    check("has_single_target", sql`(((((youtube_video_id IS NOT NULL))::integer + ((discord_channel_id IS NOT NULL))::integer) + ((connected_account_id IS NOT NULL))::integer) + ((media_asset_id IS NOT NULL))::integer) = 1`),
]);

export const externalContent = pgTable("external_content", {
    id: uuid().defaultRandom().primaryKey().notNull(),
    accountId: uuid("account_id").notNull(),
    contentType: text("content_type").notNull(),
    rawData: jsonb("raw_data").notNull(),
    contentHash: text("content_hash"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
    foreignKey({
        columns: [table.accountId],
        foreignColumns: [connectedAccounts.id],
        name: "external_content_account_id_fkey"
    }).onDelete("cascade"),
    unique("external_content_account_id_content_hash_key").on(table.accountId, table.contentHash),
    check("external_content_content_type_check", sql`content_type <> ALL (ARRAY['youtube_video'::text, 'youtube_comment'::text, 'youtube_channel'::text])`),
]);

export const scores = pgTable("scores", {
    id: uuid().defaultRandom().primaryKey().notNull(),
    honesty: doublePrecision().notNull(),
    emotionality: doublePrecision().notNull(),
    extraversion: doublePrecision().notNull(),
    agreeableness: doublePrecision().notNull(),
    conscientiousness: doublePrecision().notNull(),
    opennessToExperience: doublePrecision("openness_to_experience").notNull(),
    agency: doublePrecision().notNull(),
    achievement: doublePrecision().notNull(),
    influence: doublePrecision().notNull(),
    sarcasm: doublePrecision().notNull(),
    security: doublePrecision().notNull(),
    selfReflection: doublePrecision("self_reflection").notNull(),
    technicalCompetence: doublePrecision("technical_competence").notNull(),
    busyness: doublePrecision().notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    llmSummary: text("llm_summary"),
});

export const discordChannels = pgTable("discord_channels", {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    channelId: bigint("channel_id", { mode: "number" }).primaryKey().notNull(),
    name: text().notNull(),
    channelType: discordChannelType("channel_type").notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    parentChannelId: bigint("parent_channel_id", { mode: "number" }),
}, (table) => [
    foreignKey({
        columns: [table.parentChannelId],
        foreignColumns: [table.channelId],
        name: "discord_channels_parent_channel_id_fkey"
    }),
]);

export const messages = pgTable("messages", {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    messageId: bigint("message_id", { mode: "number" }).primaryKey().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    channelId: bigint("channel_id", { mode: "number" }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    sentBy: bigint("sent_by", { mode: "number" }).notNull(),
    content: text().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }).notNull(),
    addedAt: timestamp("added_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    lastEdited: timestamp("last_edited", { withTimezone: true, mode: 'string' }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    inReplyTo: bigint("in_reply_to", { mode: "number" }),
}, (table) => [
    index("idx_messages_active").using("btree", table.channelId.asc().nullsLast().op("int8_ops"), table.sentAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(deleted_at IS NULL)`),
    index("idx_messages_channel_id").using("btree", table.channelId.asc().nullsLast().op("int8_ops")),
    index("idx_messages_channel_sent").using("btree", table.channelId.asc().nullsLast().op("int8_ops"), table.sentAt.desc().nullsFirst().op("int8_ops")),
    index("idx_messages_in_reply_to").using("btree", table.inReplyTo.asc().nullsLast().op("int8_ops")).where(sql`(in_reply_to IS NOT NULL)`),
    index("idx_messages_sent_at").using("btree", table.sentAt.desc().nullsFirst().op("timestamptz_ops")),
    index("idx_messages_sent_by").using("btree", table.sentBy.asc().nullsLast().op("int8_ops")),
    index("idx_messages_user_sent").using("btree", table.sentBy.asc().nullsLast().op("int8_ops"), table.sentAt.desc().nullsFirst().op("int8_ops")),
    foreignKey({
        columns: [table.sentBy],
        foreignColumns: [discordAccounts.discordUserId],
        name: "fk_messages_sent_by"
    }),
    foreignKey({
        columns: [table.channelId],
        foreignColumns: [discordChannels.channelId],
        name: "messages_channel_id_fkey"
    }),
    foreignKey({
        columns: [table.inReplyTo],
        foreignColumns: [table.messageId],
        name: "messages_in_reply_to_fkey"
    }),
]);

export const mediaAssets = pgTable("media_assets", {
    id: uuid().defaultRandom().primaryKey().notNull(),
    contentType: text("content_type").notNull(),
    objectKey: text("object_key").notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    contentHash: text("content_hash"),
    embedding: vector("embedding", { dimensions: 1536 }),
}, (table) => [
    unique("media_assets_object_key_key").on(table.objectKey),
    unique("media_assets_content_hash_key").on(table.contentHash),
]);

export const messageEdits = pgTable("message_edits", {
    id: uuid().defaultRandom().primaryKey().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    messageId: bigint("message_id", { mode: "number" }).notNull(),
    oldContent: text("old_content").notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
    index("idx_message_edits_message_id").using("btree", table.messageId.asc().nullsLast().op("int8_ops"), table.editedAt.asc().nullsLast().op("int8_ops")),
    foreignKey({
        columns: [table.messageId],
        foreignColumns: [messages.messageId],
        name: "message_edits_message_id_fkey"
    }).onDelete("cascade"),
]);

export const topicMessageRelation = pgTable("topic_message_relation", {
    id: uuid().defaultRandom().primaryKey().notNull(),
    topicId: uuid("topic_id").notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    messageId: bigint("message_id", { mode: "number" }).notNull(),
}, (table) => [
    foreignKey({
        columns: [table.messageId],
        foreignColumns: [messages.messageId],
        name: "topic_message_relation_message_id_fkey"
    }),
    foreignKey({
        columns: [table.topicId],
        foreignColumns: [topic.id],
        name: "topic_message_relation_topic_id_fkey"
    }),
]);

export const messageClassificationAttempts = pgTable("message_classification_attempts", {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    messageId: bigint("message_id", { mode: "number" }).primaryKey().notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
    foreignKey({
        columns: [table.messageId],
        foreignColumns: [messages.messageId],
        name: "message_classification_attempts_message_id_fkey"
    }),
]);

export const topic = pgTable("topic", {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
});

export const userFactsAndActivities = pgTable("user_facts_and_activities", {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    recordType: activityRecordType("record_type").notNull(),
    source: activitySource().notNull(),
    scoreId: uuid("score_id"),
    type: text().notNull(),
    value: text().notNull(),
    confidence: real().default(1).notNull(),
    level: smallint(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: 'string' }),
    isCurrent: boolean("is_current").default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    typeValueEmbedding: vector("type_value_embedding", { dimensions: 1536 }),
}, (table) => [
    foreignKey({
        columns: [table.scoreId],
        foreignColumns: [scores.id],
        name: "user_facts_and_activities_score_id_fkey"
    }),
    foreignKey({
        columns: [table.userId],
        foreignColumns: [vestibuleUsers.id],
        name: "user_facts_and_activities_user_id_fkey"
    }).onDelete("cascade"),
    check("user_facts_and_activities_level_check", sql`(level >= 0) AND (level <= 10)`),
]);

export const factExtractionAttempts = pgTable("fact_extraction_attempts", {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    messageId: bigint("message_id", { mode: "number" }).primaryKey().notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
    foreignKey({
        columns: [table.messageId],
        foreignColumns: [messages.messageId],
        name: "fact_extraction_attempts_message_id_fkey"
    }),
]);

export const factAndActivityEvidence = pgTable("fact_and_activity_evidence", {
    id: uuid().defaultRandom().primaryKey().notNull(),
    factOrActivityId: uuid("fact_or_activity_id").notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    messageId: bigint("message_id", { mode: "number" }),
    youtubeCommentId: text("youtube_comment_id"),
    externalContentId: uuid("external_content_id"),
    discordPresenceId: uuid("discord_presence_id"),
    weight: real().default(1).notNull(),
    reasoning: text().notNull(),
}, (table) => [
    foreignKey({
        columns: [table.discordPresenceId],
        foreignColumns: [discordUserPresence.id],
        name: "fact_and_activity_evidence_discord_presence_id_fkey"
    }).onDelete("cascade"),
    foreignKey({
        columns: [table.externalContentId],
        foreignColumns: [externalContent.id],
        name: "fact_and_activity_evidence_external_content_id_fkey"
    }).onDelete("cascade"),
    foreignKey({
        columns: [table.factOrActivityId],
        foreignColumns: [userFactsAndActivities.id],
        name: "fact_and_activity_evidence_fact_or_activity_id_fkey"
    }).onDelete("cascade"),
    foreignKey({
        columns: [table.messageId],
        foreignColumns: [messages.messageId],
        name: "fact_and_activity_evidence_message_id_fkey"
    }).onDelete("cascade"),
    foreignKey({
        columns: [table.youtubeCommentId],
        foreignColumns: [youtubeComments.commentId],
        name: "fact_and_activity_evidence_youtube_comment_id_fkey"
    }).onDelete("cascade"),
    unique("fact_and_activity_evidence_fact_or_activity_id_message_id_y_key").on(table.factOrActivityId, table.messageId, table.youtubeCommentId, table.externalContentId, table.discordPresenceId),
    check("has_single_evidence_source", sql`(((((message_id IS NOT NULL))::integer + ((youtube_comment_id IS NOT NULL))::integer) + ((external_content_id IS NOT NULL))::integer) + ((discord_presence_id IS NOT NULL))::integer) = 1`),
]);
