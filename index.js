// EBFL OAuth Backend with CommonJS for Railway

const express = require("express");
const session = require("express-session");
const fetch = require("node-fetch");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 8080;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = `${process.env.BASE_URL}/auth/callback`;
const GUILD_ID = process.env.GUILD_ID;
const GM_ROLE_ID = "1285962361689210890";
const WEBHOOK_URL = process.env.WEBHOOK_URL;

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.set('trust proxy', 1); // enable secure cookies behind proxy

app.use(session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        sameSite: 'none',
        secure: true
    }
}));

const prizes = [
    "Badge Card (Bronze)", "Badge Card (Silver)",
    "Badge Card (Gold)", "Badge Card (HoF)", "Upgrade Badge", "Attributes (Basic)",
    "Attributes (Standard)", "Attributes (Premium)", "Increase Attribute Limits",
    "Hotzone (Neutral)", "Hotzone (Cold)", "Hotzone (Hot)", "Cold Zone Removal",
    "Dunk Package", "Layup Package"
];

app.get("/auth/discord", (req, res) => {
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify guilds guilds.members.read`;
    res.redirect(discordAuthUrl);
});

app.get("/auth/callback", async (req, res) => {
    console.log("Discord OAuth callback triggered.");
    const code = req.query.code;
    if (!code) return res.status(400).send("Missing code");

    try {
        const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: REDIRECT_URI,
                scope: "identify guilds guilds.members.read"
            })
        });

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        const userResponse = await fetch("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const user = await userResponse.json();

        const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const member = await memberResponse.json();

        const isGM = member.roles && member.roles.includes(GM_ROLE_ID);
        if (!isGM) {
            console.log(`User ${user.username} (${user.id}) does not have GM role.`);
            return res.status(403).send("You do not have GM role.");
        }

        req.session.user = { id: user.id, username: user.username, isGM };
        console.log("Session user set:", req.session.user);
        res.redirect(process.env.FRONTEND_URL || "https://ebfl-project.vercel.app");
    } catch (err) {
        console.error(err);
        res.status(500).send("OAuth callback error");
    }
});

app.get("/auth/check", (req, res) => {
    if (req.session.user && req.session.user.isGM) {
        res.json({ username: req.session.user.username, isGM: true });
    } else {
        res.status(401).send("Unauthorized");
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
            return res.status(500).send("Logout failed.");
        }
        res.clearCookie("connect.sid", { path: '/' });
        res.redirect(process.env.FRONTEND_URL || "https://ebfl-project.vercel.app");
    });
});

app.get("/spin", async (req, res) => {
    if (!req.session.user || !req.session.user.isGM) return res.status(401).send("Unauthorized");

    function getEPPrize() {
        return Math.random() < 0.10
            ? `EP (${Math.floor(Math.random() * 6) + 15})` // 15-20
            : `EP (${Math.floor(Math.random() * 14) + 1})`; // 1-14
    }

    function getECPrize() {
        return Math.random() < 0.20
            ? `EC (${Math.floor(Math.random() * 3) + 3})` // 3-5
            : `EC (${Math.floor(Math.random() * 2) + 1})`; // 1-2
    }

    function getDiscordCoinPrize() {
        return Math.random() < 0.10
            ? `Discord Coin (${Math.floor(Math.random() * 501) + 1500})` // 1500-2000
            : `Discord Coin (${Math.floor(Math.random() * 501) + 500})`; // 500-1000
    }

    function getAttributePrize(type) {
        const amount = Math.floor(Math.random() * 9) + 2; // 2-10
        return `Attributes (${type}) (+${amount})`;
    }

    let prize;
    const roll = Math.random();

    if (roll < 0.20) { // 20% for EP
        prize = getEPPrize();
    } else if (roll < 0.40) { // 20% for EC
        prize = getECPrize();
    } else if (roll < 0.60) { // 20% for Discord Coin
        prize = getDiscordCoinPrize();
    } else {
        let basePrize = prizes[Math.floor(Math.random() * prizes.length)];
        if (basePrize === "EC") {
            prize = getECPrize();
        } else if (basePrize === "Discord Coin") {
            prize = getDiscordCoinPrize();
        } else if (basePrize.startsWith("Attributes")) {
            const type = basePrize.match(/\(([^)]+)\)/)[1];
            prize = getAttributePrize(type);
        } else {
            prize = basePrize;
        }
    }

    await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            content: `**${req.session.user.username}** shuffle cards and won **${prize}**!`
        })
    });

    res.json({ prize });
});

app.listen(port, () => console.log(`✅ EBFL OAuth Backend running on port ${port}`));
