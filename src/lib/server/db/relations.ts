import { relations } from "drizzle-orm/relations";
import { mediaAssets, messageAttachments, messages, vestibuleUsers, scores, discordAccounts, discordEmojis, messageReactions, socialPlatforms, discordUserPresence, connectedAccounts, youtubeVideos, youtubeComments, jobs, discordChannels, externalContent, messageEdits, topicMessageRelation, topic, messageClassificationAttempts, userFactsAndActivities, factExtractionAttempts, factAndActivityEvidence } from "./schema";

export const messageAttachmentsRelations = relations(messageAttachments, ({ one }) => ({
    mediaAsset: one(mediaAssets, {
        fields: [messageAttachments.assetId],
        references: [mediaAssets.id]
    }),
    message: one(messages, {
        fields: [messageAttachments.messageId],
        references: [messages.messageId]
    }),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ many }) => ({
    messageAttachments: many(messageAttachments),
    discordEmojis: many(discordEmojis),
    socialPlatforms: many(socialPlatforms),
    connectedAccounts: many(connectedAccounts),
    youtubeVideos_audioAssetId: many(youtubeVideos, {
        relationName: "youtubeVideos_audioAssetId_mediaAssets_id"
    }),
    youtubeVideos_thumbnailAssetId: many(youtubeVideos, {
        relationName: "youtubeVideos_thumbnailAssetId_mediaAssets_id"
    }),
    youtubeVideos_transcriptAssetId: many(youtubeVideos, {
        relationName: "youtubeVideos_transcriptAssetId_mediaAssets_id"
    }),
    jobs: many(jobs),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
    messageAttachments: many(messageAttachments),
    vestibuleUsers: many(vestibuleUsers),
    messageReactions: many(messageReactions),
    discordUserPresences: many(discordUserPresence),
    connectedAccounts: many(connectedAccounts),
    discordAccount: one(discordAccounts, {
        fields: [messages.sentBy],
        references: [discordAccounts.discordUserId]
    }),
    discordChannel: one(discordChannels, {
        fields: [messages.channelId],
        references: [discordChannels.channelId]
    }),
    message: one(messages, {
        fields: [messages.inReplyTo],
        references: [messages.messageId],
        relationName: "messages_inReplyTo_messages_messageId"
    }),
    messages: many(messages, {
        relationName: "messages_inReplyTo_messages_messageId"
    }),
    messageEdits: many(messageEdits),
    topicMessageRelations: many(topicMessageRelation),
    messageClassificationAttempts: many(messageClassificationAttempts),
    factExtractionAttempts: many(factExtractionAttempts),
    factAndActivityEvidences: many(factAndActivityEvidence),
}));

export const vestibuleUsersRelations = relations(vestibuleUsers, ({ one, many }) => ({
    message: one(messages, {
        fields: [vestibuleUsers.introMessageId],
        references: [messages.messageId]
    }),
    score: one(scores, {
        fields: [vestibuleUsers.scoreId],
        references: [scores.id]
    }),
    discordAccounts: many(discordAccounts),
    connectedAccounts: many(connectedAccounts),
    userFactsAndActivities: many(userFactsAndActivities),
}));

export const scoresRelations = relations(scores, ({ many }) => ({
    vestibuleUsers: many(vestibuleUsers),
    userFactsAndActivities: many(userFactsAndActivities),
}));

export const discordAccountsRelations = relations(discordAccounts, ({ one, many }) => ({
    vestibuleUser: one(vestibuleUsers, {
        fields: [discordAccounts.vestibuleUserId],
        references: [vestibuleUsers.id]
    }),
    messageReactions: many(messageReactions),
    discordUserPresences: many(discordUserPresence),
    messages: many(messages),
}));

export const discordEmojisRelations = relations(discordEmojis, ({ one, many }) => ({
    mediaAsset: one(mediaAssets, {
        fields: [discordEmojis.assetId],
        references: [mediaAssets.id]
    }),
    messageReactions: many(messageReactions),
}));

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
    discordEmoji: one(discordEmojis, {
        fields: [messageReactions.emojiId],
        references: [discordEmojis.id]
    }),
    message: one(messages, {
        fields: [messageReactions.messageId],
        references: [messages.messageId]
    }),
    discordAccount: one(discordAccounts, {
        fields: [messageReactions.userId],
        references: [discordAccounts.discordUserId]
    }),
}));

export const socialPlatformsRelations = relations(socialPlatforms, ({ one, many }) => ({
    mediaAsset: one(mediaAssets, {
        fields: [socialPlatforms.logo],
        references: [mediaAssets.id]
    }),
    connectedAccounts: many(connectedAccounts),
}));

export const discordUserPresenceRelations = relations(discordUserPresence, ({ one, many }) => ({
    message: one(messages, {
        fields: [discordUserPresence.evidenceMessageId],
        references: [messages.messageId]
    }),
    discordAccount: one(discordAccounts, {
        fields: [discordUserPresence.userId],
        references: [discordAccounts.discordUserId]
    }),
    factAndActivityEvidences: many(factAndActivityEvidence),
}));

export const connectedAccountsRelations = relations(connectedAccounts, ({ one, many }) => ({
    message: one(messages, {
        fields: [connectedAccounts.mentionMessageId],
        references: [messages.messageId]
    }),
    socialPlatform: one(socialPlatforms, {
        fields: [connectedAccounts.platformId],
        references: [socialPlatforms.id]
    }),
    mediaAsset: one(mediaAssets, {
        fields: [connectedAccounts.profilePicture],
        references: [mediaAssets.id]
    }),
    vestibuleUser: one(vestibuleUsers, {
        fields: [connectedAccounts.vestibuleUserId],
        references: [vestibuleUsers.id]
    }),
    youtubeVideos: many(youtubeVideos),
    youtubeComments: many(youtubeComments),
    jobs: many(jobs),
    externalContents: many(externalContent),
}));

export const youtubeVideosRelations = relations(youtubeVideos, ({ one, many }) => ({
    mediaAsset_audioAssetId: one(mediaAssets, {
        fields: [youtubeVideos.audioAssetId],
        references: [mediaAssets.id],
        relationName: "youtubeVideos_audioAssetId_mediaAssets_id"
    }),
    connectedAccount: one(connectedAccounts, {
        fields: [youtubeVideos.channelVestibuleId],
        references: [connectedAccounts.id]
    }),
    mediaAsset_thumbnailAssetId: one(mediaAssets, {
        fields: [youtubeVideos.thumbnailAssetId],
        references: [mediaAssets.id],
        relationName: "youtubeVideos_thumbnailAssetId_mediaAssets_id"
    }),
    mediaAsset_transcriptAssetId: one(mediaAssets, {
        fields: [youtubeVideos.transcriptAssetId],
        references: [mediaAssets.id],
        relationName: "youtubeVideos_transcriptAssetId_mediaAssets_id"
    }),
    youtubeComments: many(youtubeComments),
    jobs: many(jobs),
}));

export const youtubeCommentsRelations = relations(youtubeComments, ({ one, many }) => ({
    connectedAccount: one(connectedAccounts, {
        fields: [youtubeComments.authorChannelId],
        references: [connectedAccounts.id]
    }),
    youtubeComment: one(youtubeComments, {
        fields: [youtubeComments.inReplyTo],
        references: [youtubeComments.commentId],
        relationName: "youtubeComments_inReplyTo_youtubeComments_commentId"
    }),
    youtubeComments: many(youtubeComments, {
        relationName: "youtubeComments_inReplyTo_youtubeComments_commentId"
    }),
    youtubeVideo: one(youtubeVideos, {
        fields: [youtubeComments.videoId],
        references: [youtubeVideos.videoId]
    }),
    factAndActivityEvidences: many(factAndActivityEvidence),
}));

export const jobsRelations = relations(jobs, ({ one }) => ({
    connectedAccount: one(connectedAccounts, {
        fields: [jobs.connectedAccountId],
        references: [connectedAccounts.id]
    }),
    discordChannel: one(discordChannels, {
        fields: [jobs.discordChannelId],
        references: [discordChannels.channelId]
    }),
    mediaAsset: one(mediaAssets, {
        fields: [jobs.mediaAssetId],
        references: [mediaAssets.id]
    }),
    youtubeVideo: one(youtubeVideos, {
        fields: [jobs.youtubeVideoId],
        references: [youtubeVideos.videoId]
    }),
}));

export const discordChannelsRelations = relations(discordChannels, ({ one, many }) => ({
    jobs: many(jobs),
    discordChannel: one(discordChannels, {
        fields: [discordChannels.parentChannelId],
        references: [discordChannels.channelId],
        relationName: "discordChannels_parentChannelId_discordChannels_channelId"
    }),
    discordChannels: many(discordChannels, {
        relationName: "discordChannels_parentChannelId_discordChannels_channelId"
    }),
    messages: many(messages),
}));

export const externalContentRelations = relations(externalContent, ({ one, many }) => ({
    connectedAccount: one(connectedAccounts, {
        fields: [externalContent.accountId],
        references: [connectedAccounts.id]
    }),
    factAndActivityEvidences: many(factAndActivityEvidence),
}));

export const messageEditsRelations = relations(messageEdits, ({ one }) => ({
    message: one(messages, {
        fields: [messageEdits.messageId],
        references: [messages.messageId]
    }),
}));

export const topicMessageRelationRelations = relations(topicMessageRelation, ({ one }) => ({
    message: one(messages, {
        fields: [topicMessageRelation.messageId],
        references: [messages.messageId]
    }),
    topic: one(topic, {
        fields: [topicMessageRelation.topicId],
        references: [topic.id]
    }),
}));

export const topicRelations = relations(topic, ({ many }) => ({
    topicMessageRelations: many(topicMessageRelation),
}));

export const messageClassificationAttemptsRelations = relations(messageClassificationAttempts, ({ one }) => ({
    message: one(messages, {
        fields: [messageClassificationAttempts.messageId],
        references: [messages.messageId]
    }),
}));

export const userFactsAndActivitiesRelations = relations(userFactsAndActivities, ({ one, many }) => ({
    score: one(scores, {
        fields: [userFactsAndActivities.scoreId],
        references: [scores.id]
    }),
    vestibuleUser: one(vestibuleUsers, {
        fields: [userFactsAndActivities.userId],
        references: [vestibuleUsers.id]
    }),
    factAndActivityEvidences: many(factAndActivityEvidence),
}));

export const factExtractionAttemptsRelations = relations(factExtractionAttempts, ({ one }) => ({
    message: one(messages, {
        fields: [factExtractionAttempts.messageId],
        references: [messages.messageId]
    }),
}));

export const factAndActivityEvidenceRelations = relations(factAndActivityEvidence, ({ one }) => ({
    discordUserPresence: one(discordUserPresence, {
        fields: [factAndActivityEvidence.discordPresenceId],
        references: [discordUserPresence.id]
    }),
    externalContent: one(externalContent, {
        fields: [factAndActivityEvidence.externalContentId],
        references: [externalContent.id]
    }),
    userFactsAndActivity: one(userFactsAndActivities, {
        fields: [factAndActivityEvidence.factOrActivityId],
        references: [userFactsAndActivities.id]
    }),
    message: one(messages, {
        fields: [factAndActivityEvidence.messageId],
        references: [messages.messageId]
    }),
    youtubeComment: one(youtubeComments, {
        fields: [factAndActivityEvidence.youtubeCommentId],
        references: [youtubeComments.commentId]
    }),
}));