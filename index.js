const express = require('express');
const fetch = require('node-fetch');
const session = require('express-session');
const app = express();
const port = process.env.PORT || 3000;

const CLIENT_ID = '1395560873447391232';
const CLIENT_SECRET = 'CFaM_rnR-iLUvEyNOT3JnV9B2shL4Fno';
const REDIRECT_URI = 'https://ebfl-project.vercel.app/callback';

const GM_ROLE_ID = '1285962361689210890';
const GUILD_ID = '636938519037870080'; // Replace with your Discord server ID

app.use(session({
    secret: 'ebfl_spin_secret',
    resave: false,
    saveUninitialized: true,
}));

app.get('/login', (req, res) => {
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify guilds guilds.members.read`;
    res.redirect(discordAuthUrl);
});

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('No code provided');

    try {
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT_URI,
            }),
        });
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const userData = await userResponse.json();

        const memberResponse = await fetch(\`https://discord.com/api/users/@me/guilds/\${GUILD_ID}/member\`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const memberData = await memberResponse.json();

        const hasGMRole = memberData.roles && memberData.roles.includes(GM_ROLE_ID);

        req.session.user = {
            id: userData.id,
            username: userData.username,
            discriminator: userData.discriminator,
            avatar: userData.avatar,
            isGM: hasGMRole,
        };

        res.redirect('/');
    } catch (error) {
        console.error('OAuth Error:', error);
        res.send('OAuth failed, try again.');
    }
});

app.get('/user', (req, res) => {
    if (!req.session.user) return res.json({ authenticated: false });
    res.json({ authenticated: true, user: req.session.user });
});

app.listen(port, () => console.log(\`EBFL OAuth Backend running on port \${port}\`));
