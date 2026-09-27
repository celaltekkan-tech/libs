'use strict';

const http = require('http');
const https = require('https');
const path = require('path');
const { URL, URLSearchParams } = require('url');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPE = 'https://www.googleapis.com/auth/drive';

function postForm(fields) {
  const body = new URLSearchParams(fields).toString();
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: 'POST',
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = {};
          try {
            json = JSON.parse(text);
          } catch {
            json = { error: text.slice(0, 300) };
          }
          if ((res.statusCode || 500) >= 300) {
            reject(new Error(json.error_description || json.error || `HTTP ${res.statusCode}`));
            return;
          }
          resolve(json);
        });
      }
    );
    req.on('error', reject);
    req.end(body);
  });
}

async function main() {
  const clientId = String(process.env.GOOGLE_DRIVE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_DRIVE_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    console.error('Önce .env içine GOOGLE_DRIVE_CLIENT_ID ve GOOGLE_DRIVE_CLIENT_SECRET yazın.');
    process.exit(1);
  }

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log('Google Cloud OAuth istemcisinde (Masaüstü uygulaması) şu yönlendirme URI kayıtlı olmalı:');
  console.log(REDIRECT);
  console.log('\nTarayıcıda açın:\n');
  console.log(authUrl.toString());
  console.log('\nOnaydan sonra refresh token burada yazılacak. Pencereyi kapatmayın.');

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', REDIRECT);
    if (url.pathname !== '/callback') {
      res.writeHead(404);
      res.end();
      return;
    }
    const code = url.searchParams.get('code');
    const oauthError = url.searchParams.get('error');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (oauthError || !code) {
      res.end('<p>Yetkilendirme başarısız. Terminaldeki hataya bakın.</p>');
      console.error(oauthError || 'Yetkilendirme kodu gelmedi');
      server.close();
      process.exit(1);
      return;
    }
    try {
      const token = await postForm({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT,
        grant_type: 'authorization_code',
      });
      res.end('<p>Tamam. Refresh token terminalde. Bu sekmeyi kapatabilirsiniz.</p>');
      if (!token.refresh_token) {
        console.error('\nRefresh token gelmedi. Google hesabınızda bu uygulamanın erişimini kaldırıp yeniden deneyin.');
        server.close();
        process.exit(1);
        return;
      }
      console.log('\n.env dosyasına ekleyin:\n');
      console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${token.refresh_token}`);
      server.close();
      process.exit(0);
    } catch (err) {
      res.end('<p>Token alınamadı. Terminaldeki hataya bakın.</p>');
      console.error(err.message);
      server.close();
      process.exit(1);
    }
  });

  server.listen(PORT, '127.0.0.1');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
