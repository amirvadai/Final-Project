const fs = require("fs");

function getWebhookUrl() {
    return String(
        process.env.DISCORD_WEBHOOK_URL || ""
    ).trim();
}

function parseWebhookUrl() {
    const webhookUrl = getWebhookUrl();

    if (!webhookUrl) {
        throw new Error(
            "DISCORD_WEBHOOK_URL is not configured."
        );
    }

    const url = new URL(webhookUrl);
    const threadId = url.searchParams.get("thread_id");

    url.search = "";
    url.hash = "";

    return {
        url,
        threadId
    };
}

async function sendPostToDiscord({
    text,
    file,
    displayName
}) {
    const parsed = parseWebhookUrl();
    const requestUrl = new URL(parsed.url);

    requestUrl.searchParams.set("wait", "true");

    if (parsed.threadId) {
        requestUrl.searchParams.set(
            "thread_id",
            parsed.threadId
        );
    }

    const name =
        String(displayName || "").trim() ||
        "Community member";

    const formData = new FormData();

    formData.append(
        "content",
        `**A new post was uploaded to City Community by ${name}!**\n**Text Content:**\n${text}`
    );

    if (file) {
        const fileBuffer = fs.readFileSync(file.path);
        const fileBlob = new Blob(
            [fileBuffer],
            {
                type: file.mimetype
            }
        );

        formData.append(
            "file",
            fileBlob,
            file.filename
        );
    }

    const response = await fetch(
        requestUrl,
        {
            method: "POST",
            body: formData
        }
    );

    const responseText = await response.text();

    if (!response.ok) {
        throw new Error(
            `Discord webhook failed with status ${response.status}: ${responseText}`
        );
    }

    let message;

    try {
        message = JSON.parse(responseText);
    } catch {
        throw new Error(
            "Discord did not return the created message."
        );
    }

    if (!message?.id) {
        throw new Error(
            "Discord did not return a message ID."
        );
    }

    return {
        messageId: String(message.id),
        threadId: parsed.threadId
    };
}

async function deleteDiscordMessage(
    messageId,
    threadId = null
) {
    if (!messageId) {
        return;
    }

    const parsed = parseWebhookUrl();
    const requestUrl = new URL(parsed.url);

    requestUrl.pathname =
        `${requestUrl.pathname.replace(/\/+$/, "")}/messages/${encodeURIComponent(messageId)}`;

    const effectiveThreadId =
        threadId ||
        parsed.threadId;

    if (effectiveThreadId) {
        requestUrl.searchParams.set(
            "thread_id",
            effectiveThreadId
        );
    }

    const response = await fetch(
        requestUrl,
        {
            method: "DELETE"
        }
    );

    if (
        response.status === 204 ||
        response.status === 404
    ) {
        return;
    }

    const responseText = await response.text();

    throw new Error(
        `Discord message deletion failed with status ${response.status}: ${responseText}`
    );
}

module.exports = {
    sendPostToDiscord,
    deleteDiscordMessage
};
