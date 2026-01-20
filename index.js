const { default: makeWASocket, useMultiFileAuthState, makeInMemoryStore, downloadMediaMessage } = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require('fs');
const axios = require('axios');
const qrcode = require('qrcode-terminal');
const path = require('path');
const { exec } = require('child_process');

//import Plugins
const { getRandomPerkalian, cekjawaban } = require('./plugins/Perkalian.js');
const { AsakOtakList } = require("./plugins/List/AsakOtakList.js");

const MAX_MONEY = 1000000000; // Batas maksimum uang ($1 miliar)
const assetDataFile = 'assets.json';

const game = {
    roomActive: false,
    players: {}, // Menyimpan ID pemain
    werewolf: null,
    seer: null,
    villager: [],
    night: false,
    votes: {},
    timer: null // Timer untuk fase permainan
};

let assets = [
    { name: "Dogecoin", price: 6, previousPrice: 25  },
    { name: "Bitcoin", price: 90, previousPrice: 90 },
    { name: "Emas", price: 30, previousPrice: 30 },
    { name: "Ethereum", price: 50, previousPrice: 50 },
    { name: "Litecoin", price: 25, previousPrice: 25 },
];


const jobConfig = {
    "Tukang Sampah": { absencesPerDay: 1, salaryPerAbsence: 10 },
    "Petugas Kebersihan": { absencesPerDay: 2, salaryPerAbsence: 13 },
    "Kurir": { absencesPerDay: 3, salaryPerAbsence: 15 },
    "Kasir": { absencesPerDay: 1, salaryPerAbsence: 20 },
    "Penjual": { absencesPerDay: 2, salaryPerAbsence: 25 },
    "Asisten Kantor": { absencesPerDay: 3, salaryPerAbsence: 10 }
};
function getExpForNextLevel(level) {
    return level * 100;
}
// Muat harga aset dari file jika ada
if (fs.existsSync(assetDataFile)) {
    try {
        const fileContent = fs.readFileSync(assetDataFile, "utf-8");
        const loadedAssets = JSON.parse(fileContent);
        assets.forEach((asset, index) => {
            if (loadedAssets[index]) {
                asset.price = loadedAssets[index].price;
            }
        });
        console.log("✅ Harga aset berhasil dimuat dari file.");
    } catch (error) {
        console.error("❌ Gagal memuat harga aset dari file:", error);
    }
}

// fucntion untuk memperbarui harga aset
function updateAssetPrices() {
    for (const asset of assets) {
        const changePercent = (Math.random() * 10 - 5) / 100; // Perubahan harga antara -5% hingga +5%
        const oldPrice = asset.price;
        const newPrice = Math.max(0.01, oldPrice + oldPrice * changePercent);
        asset.previousPrice = asset.price; // Simpan harga sebelumnya
        asset.price = parseFloat(newPrice.toFixed(2)); // Batasi 2 desimal
    }
    console.log("📈 Harga aset diperbarui:", assets);
}

// Fungsi untuk menyimpan harga aset ke file
function saveAssetPrices() {
    try {
        fs.writeFileSync(assetDataFile, JSON.stringify(assets, null, 2));
        console.log("✅ Harga aset berhasil disimpan ke file.");
    } catch (error) {
        console.error("❌ Gagal menyimpan harga aset ke file:", error);
    }
}


async function startBot() {
    console.log("🚀 Memulai bot...");

    // Sistem login pakai session
    const { state, saveCreds } = await useMultiFileAuthState("session");
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: P({ level: "silent" }),
    });

    sock.ev.on("creds.update", saveCreds);

    let currentQuestion = null;
    let currentAnswer = null;

    // Handle pesan masuk
    sock.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message) return;

            const from = msg.key.remoteJid;
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            const isGroup = from.endsWith("@g.us");

            console.log(`📩 Pesan dari: ${from} | Grup: ${isGroup ? "Ya" : "Tidak"} | Isi: ${body}`);

            // Perintah !menu
            if (body.startsWith("!menu")) {
                console.log("✅ Perintah !menu diterima, memproses...");
                try {
                    const imageBuffer = fs.readFileSync('assets/menu-img.jpg');
                    const menuText = `🤖 *Dafitra Bot* 🤖
Perkenalkan, saya adalah Dafitra_Bot. Silakan lihat daftar menu di bawah ini untuk mengetahui berbagai fitur yang dapat saya lakukan.

「  I N F O  B O T  」
ִֶָ☾. Name : Dafitra_Bot
ִֶָ☾. Owner : +62821-8380-7360
ִֶָ☾. Total Fitur : 4 Fitur
ִֶָ☾. Total Command : 7 Command
ִֶָ☾. Prefix : ( Prefix_Bot )
ִֶָ☾. Language : Bahasa Indonesia
ִֶָ☾. Library : Baileys
ִֶָ☾. Runtime : Node.js
ִֶָ☾. Version : 1.0.0

「  F I T U R  B O T  」
ִֶָ☾. !menu
ִֶָ☾. !nsfw [Query]
ִֶָ☾ !create → Untuk membuat akun
☾ Pekerjaan*:
   - !listjob → Melihat daftar pekerjaan yang tersedia.
   - !job [nomor] → Memilih pekerjaan.
   - !work → Absen harian untuk mendapatkan gaji.

ִֶָ☾ *Investasi*:
   - !harga → Melihat harga aset saat ini.
   - !beli [nomor aset] [jumlah] → Membeli aset.
   - !jual [nomor aset] [jumlah] → Menjual aset.

ִֶָ☾ *Judi*:
   - !judi [jumlah taruhan] [head/tail] → Bermain judi lempar koin.
   - !togel [jumlah taruhan] [angka (2-4 digit)] → Bermain togel.

ִֶָ☾ *Status*:
   - !status → Melihat status akun Anda (level, uang, aset, dll.).

ִֶָ☾ *Asak Otak*:
   !asahotak → Melihat daftar permainan asah otak.

ִֶָ☾ *Tools*:
    - !dwd [URL] → Mengunduh video dari URL yang diberikan.


ִֶָ☾ *Admin*:
   - !topup [jumlah] [@tag atau nomor] → Menambahkan uang ke akun pengguna (admin saja).

`;

                    await sock.sendMessage(from, { 
                        image: imageBuffer, 
                        caption: menuText 
                    });

                    console.log("✅ Menu berhasil dikirim!");
                } catch (error) {
                    console.error("❌ Gagal mengirim menu:", error);
                }
            }


            if(body.toLowerCase().startsWith("!asahotak")) {
                AsakOtakList();
                await sock.sendMessage(from, { text: AsakOtakList });
            }

            // Perintah !tagall (hanya di grup)
            if (isGroup && body.startsWith("!tagall")) {
                console.log("✅ Perintah !tagall diterima, memproses...");
                try {
                    const groupMetadata = await sock.groupMetadata(from);
                    if (!groupMetadata) return console.log("❌ Gagal mendapatkan metadata grup.");

                    const senderId = msg.key.participant || msg.key.remoteJid;
                    const isAdmin = groupMetadata.participants.some(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));

                    if (!isAdmin) {
                        return console.log("❌ Perintah !tagall hanya dapat digunakan oleh admin grup.");
                    }

                    const members = groupMetadata.participants.map(p => p.id);
                    if (members.length === 0) return console.log("❌ Grup kosong, tidak ada yang bisa ditag.");

                    const mentions = members.map(m => `@${m.replace(/@s\.whatsapp\.net$/, "")}`).join(" ");
                    await sock.sendMessage(from, { 
                        text: `👥 Tagall:\n${mentions}`, 
                        mentions: members 
                    });

                    console.log("✅ Tagall berhasil dikirim!");
                } catch (error) {
                    console.error("❌ Gagal mengirim tag all:", error);
                }
            }

            // Perintah !tebakmtk
            if (body.startsWith("!mtk")) {
                console.log("✅ Perintah !tebakmtk diterima, memproses...");
                try {
                    const num1 = Math.floor(Math.random() * 10) + 1;
                    const num2 = Math.floor(Math.random() * 10) + 1;
                    const operator = ['+', '-', '*', '/'][Math.floor(Math.random() * 4)];
                    let question, answer;

                    switch (operator) {
                        case '+':
                            question = `${num1} + ${num2}`;
                            answer = num1 + num2;
                            break;
                        case '-':
                            question = `${num1} - ${num2}`;
                            answer = num1 - num2;
                            break;
                        case '*':
                            question = `${num1} * ${num2}`;
                            answer = num1 * num2;
                            break;
                        case '/':
                            question = `${num1} / ${num2}`;
                            answer = (num1 / num2).toFixed(2);
                            break;
                    }

                    currentQuestion = question;
                    currentAnswer = answer;
                 
                    await sock.sendMessage(from, { 
                        text: `🤔 Tebak-tebakan Matematika:\n${question}\nJawab dengan benar menggunakan perintah !a [jawaban]`, 
                    });

                    console.log("✅ Tebak-tebakan Matematika berhasil dikirim!");
                } catch (error) {
                    console.error("❌ Gagal mengirim tebak-tebakan matematika:", error);
                }
            }

            // Perintah !answer
            if (body.startsWith("!a")) {
                console.log("✅ Perintah !j jawab diterima, memproses...");
                try {
                    const userAnswer = parseFloat(body.split(" ")[1]);

                    if (userAnswer === parseFloat(currentAnswer)) {
                        await sock.sendMessage(from, { 
                            text: `🎉 Jawaban benar! ${currentQuestion} = ${currentAnswer}`, 
                        });
                    } else {
                        await sock.sendMessage(from, { 
                            text: `❌ Jawaban salah. Coba lagi! ${currentQuestion} = ${currentAnswer}`, 
                        });
                    }

                    // Reset current question and answer
                    currentQuestion = null;
                    currentAnswer = null;

                    console.log("✅ Jawaban berhasil diproses!");
                } catch (error) {
                    console.error("❌ Gagal memproses jawaban:", error);
                }
            }

            if(body.startsWith("!perkalian")) {
                await getRandomPerkalian(sock, from);
            }

            if(body.startsWith("!j ")) {
                await cekjawaban(body, sock, from);
            }

          
            // Perintah !download
            if (body.startsWith("!dwd")) {
                console.log("✅ Perintah !download diterima, memproses...");
                try {
                    const url = body.split(" ")[1];
                    if (!url) {
                        await sock.sendMessage(from, { text: "❌ Harap sertakan URL untuk diunduh." });
                        return;
                    }

                    // Buat folder Content
                    const contentDir = path.join(__dirname, 'Content');
                    if (!fs.existsSync(contentDir)) {
                        fs.mkdirSync(contentDir);
                    }

                    const fileName = `download_${Date.now()}`;
                    const filePath = path.join(contentDir, `${fileName}.mp4`);

                    
                    exec(`yt-dlp -o "${filePath}" ${url}`, async (error, stdout, stderr) => {
                        if (error) {
                            console.error(`❌ Gagal mengunduh video: ${error.message}`);
                            await sock.sendMessage(from, { text: "❌ Gagal mengunduh video. Pastikan URL valid dan coba lagi." });
                            return;
                        }

                        // Periksa apakah file mp4 benar-benar ada
                        if (!fs.existsSync(filePath)) {
                            console.error(`❌ File tidak ditemukan setelah diunduh: ${filePath}`);
                            await sock.sendMessage(from, { text: "❌ Gagal mengunduh video. File tidak ditemukan setelah diunduh." });
                            return;
                        }

                    
                        setTimeout(async () => {
                            if (fs.existsSync(filePath)) {
                                // Kirim video ke WhatsApp
                                await sock.sendMessage(from, { 
                                    video: { url: filePath }, 
                                    caption: "📥 Video berhasil diunduh!" 
                                });
                    
                                console.log("✅ Video berhasil diunduh dan dikirim!");
                            } else {
                                console.error(`❌ File tidak ditemukan setelah penundaan: ${filePath}`);
                                await sock.sendMessage(from, { text: "❌ Gagal mengunduh video. File tidak ditemukan setelah penundaan." });
                            }
                        }, 5000); // Jeda 5 detik
                    });
                } catch (error) {
                    console.error("❌ Gagal mengunduh video:", error);
                    await sock.sendMessage(from, { text: "❌ Gagal mengunduh video. Pastikan URL valid dan coba lagi." });
                }
            }

            // Perintah !gelbooru
            if (body.startsWith("!nsfw")) {
                console.log("✅ Perintah !gelbooru diterima, memproses...");
                try {

                     // Periksa apakah ini grup
                     if (!isGroup) {
                        await sock.sendMessage(from, { text: "❌ Perintah ini hanya dapat digunakan di grup." });
                        return;
                    }
            
                    // Ambil metadata grup
                    const groupMetadata = await sock.groupMetadata(from);
                    if (!groupMetadata) {
                        console.log("❌ Gagal mendapatkan metadata grup.");
                        await sock.sendMessage(from, { text: "❌ Gagal mendapatkan metadata grup." });
                        return;
                    }
            
                    // Periksa apakah pengirim adalah admin
                    const senderId = msg.key.participant || msg.key.remoteJid;
                    const isAdmin = groupMetadata.participants.some(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));
            
                    if (!isAdmin) {
                        console.log("❌ Perintah ini hanya dapat digunakan oleh admin grup.");
                        await sock.sendMessage(from, { text: "❌ Perintah ini hanya dapat digunakan oleh admin grup." });
                        return;
                    }
                    
                    const query = body.split(' ')[1];
                    if (!query) {
                        await sock.sendMessage(from, { text: '❌ Harap sertakan query pencarian.' });
                        return;
                    }

                    const response = await axios.get('https://gelbooru.com/index.php', {
                        params: {
                            page: 'dapi',
                            s: 'post',
                            q: 'index',
                            json: 1,
                            tags: query,
                            limit: 1
                        }
                    });

                    const posts = response.data.post;
                    if (posts && posts.length > 0) {
                        const post = posts[0];
                        const imageUrl = post.file_url;

                            await sock.sendMessage(from, { image: { url: imageUrl } }); //, caption: `🔍 Hasil pencarian dari Gelbooru: ${imageUrl}`

                    } else {
                        await sock.sendMessage(from, { text: '❌ Tidak ada gambar yang ditemukan untuk query Anda.' });
                    }
                } catch (error) {
                    console.error('❌ Gagal mengambil gambar dari Gelbooru:', error);
                    await sock.sendMessage(from, { text: '❌ Terjadi kesalahan saat mengambil gambar dari Gelbooru.' });
                }
            }
            //fitur maitance

            const userDataFile = 'userData.json';

            // Muat data pengguna
            let userData = {};
            if (fs.existsSync(userDataFile)) {
                try {
                    const fileContent = fs.readFileSync(userDataFile, 'utf-8');
                    userData = fileContent.trim() ? JSON.parse(fileContent) : {};
                } catch (error) {
                    console.error("❌ Gagal memuat file userData.json:", error);
                    userData = {}; // Reset ke objek kosong if error
                }
            } else {
                // Inisialisasi file
                fs.writeFileSync(userDataFile, JSON.stringify({}, null, 2));
            }
            
            //function to save user data
            function saveUserData() {
                try {
                    fs.writeFileSync(userDataFile, JSON.stringify(userData, null, 2));
                } catch (error) {
                    console.error("❌ Gagal menyimpan file userData.json:", error);
                }
            }

            //maintance
            if (body.startsWith("!create")) {
                const senderId = msg.key.participant || msg.key.remoteJid;
            
                if (userData[senderId]) {
                    await sock.sendMessage(from, { text: "❌ Anda sudah memiliki akun!" });
                    return;
                }
            
                userData[senderId] = {
                    level: 1,
                    exp: 0, //add exp
                    money: 0,
                    job: null,
                    lastWork: null,
                    missedDays: 0
                };
            
                saveUserData();
                await sock.sendMessage(from, { text: "✅ Akun berhasil dibuat! Anda sekarang berada di level 1 dengan uang $0." });
                return;
            }

            if (body.startsWith("!listjob")) {
                const senderId = msg.key.participant || msg.key.remoteJid;
            
                if (!userData[senderId]) {
                    await sock.sendMessage(from, { text: "❌ Anda belum memiliki akun. Gunakan perintah !create untuk membuat akun." });
                    return;
                }
            
                const level = userData[senderId].level;
                const jobs = {
                    1: ["Tukang Sampah", "Petugas Kebersihan", "Kurir"],
                    2: ["Kasir", "Penjual", "Asisten Kantor"]
                };
            
                if (!jobs[level]) {
                    await sock.sendMessage(from, { text: "❌ Tidak ada pekerjaan yang tersedia untuk level Anda." });
                    return;
                }
            
                const jobList = jobs[level].map((job, index) => `${index + 1}. ${job}`).join("\n");
                await sock.sendMessage(from, { text: `Pekerjaan yang tersedia untuk level ${level}:\n${jobList}\n\nGunakan perintah !job [nomor] untuk memilih pekerjaan.` });
                return;
            }

// !job
if (body.startsWith("!job")) {
    const senderId = msg.key.participant || msg.key.remoteJid;

    if (!userData[senderId]) {
        await sock.sendMessage(from, { text: "❌ Anda belum memiliki akun. Gunakan perintah !create untuk membuat akun." });
        return;
    }

    const level = userData[senderId].level;
    const jobs = {
        1: ["Tukang Sampah", "Petugas Kebersihan", "Kurir"],
        2: ["Kasir", "Penjual", "Asisten Kantor"]
    };

    if (!jobs[level]) {
        await sock.sendMessage(from, { text: "❌ Tidak ada pekerjaan yang tersedia untuk level Anda." });
        return;
    }

    const args = body.split(" ");
    if (args.length === 1) {
        await sock.sendMessage(from, { text: "❌ Harap masukkan nomor pekerjaan. Gunakan perintah !listjob untuk melihat daftar pekerjaan." });
        return;
    }

    const jobIndex = parseInt(args[1]) - 1;
    if (isNaN(jobIndex) || jobIndex < 0 || jobIndex >= jobs[level].length) {
        await sock.sendMessage(from, { text: "❌ Pilihan pekerjaan tidak valid. Gunakan perintah !listjob untuk melihat daftar pekerjaan." });
        return;
    }

    const selectedJob = jobs[level][jobIndex];
    userData[senderId].job = selectedJob;
    saveUserData();

    await sock.sendMessage(from, { text: `✅ Anda telah memilih pekerjaan: ${selectedJob}. Jangan lupa absen harian dengan mengetik !work.` });
    return;
}

if (body.startsWith("!work")) {
    const senderId = msg.key.participant || msg.key.remoteJid;

    if (!userData[senderId]) {
        await sock.sendMessage(from, { text: "❌ Anda belum memiliki akun. Gunakan perintah !create untuk membuat akun." });
        return;
    }

    const user = userData[senderId];
    if (!user.job) {
        await sock.sendMessage(from, { text: "❌ Anda belum memiliki pekerjaan. Gunakan perintah !job untuk memilih pekerjaan." });
        return;
    }

    const now = new Date();
    const today = now.toDateString();
    const jobDetails = jobConfig[user.job];

    if (!jobDetails) {
        await sock.sendMessage(from, { text: "❌ Konfigurasi pekerjaan tidak ditemukan. Hubungi admin bot." });
        return;
    }


    if (!user.absenDate || user.absenDate !== today) {
        user.absenDate = today;
        user.absenCount = 0;
        user.dailyEarnings = 0; 
    }

    if (user.absenCount >= jobDetails.absencesPerDay) {
        await sock.sendMessage(from, { text: `❌ Anda sudah menyelesaikan semua absen hari ini (${jobDetails.absencesPerDay} kali). Coba lagi besok.` });
        return;
    }

    const salaryPerAbsence = jobDetails.salaryPerAbsence;
    const maxDailyEarnings = jobDetails.absencesPerDay * salaryPerAbsence;

    if (user.dailyEarnings + salaryPerAbsence > maxDailyEarnings) {
        await sock.sendMessage(from, { text: `❌ Anda sudah mencapai batas gaji harian maksimum sebesar $${maxDailyEarnings}. Coba lagi besok.` });
        return;
    }

    // Tambahkan gaji, EXP, n absen
    user.money += salaryPerAbsence;
    user.dailyEarnings += salaryPerAbsence;
    user.absenCount += 1;

    const expGained = 10; // +10 exp
    user.exp += expGained;


    const expForNextLevel = getExpForNextLevel(user.level);
    if (user.exp >= expForNextLevel) {
        user.level += 1;
        user.exp -= expForNextLevel; // Sisa EXP setelah naik level
        await sock.sendMessage(from, { text: `🎉 Selamat! Anda naik ke level ${user.level}!` });
    }

    saveUserData();
    await sock.sendMessage(from, { 
        text: `✅ Anda telah absen sebagai ${user.job} (${user.absenCount}/${jobDetails.absencesPerDay}). Anda mendapatkan $${salaryPerAbsence} dan ${expGained} EXP. Total uang Anda: $${user.money}.` 
    });

    // if absen done
    if (user.absenCount === jobDetails.absencesPerDay) {
        await sock.sendMessage(from, { text: `🎉 Anda telah menyelesaikan semua absen hari ini sebagai ${user.job}. Kerja bagus!` });
    }

    return;
}
//status
if (body.startsWith("!status")) {
    const senderId = msg.key.participant || msg.key.remoteJid;

    if (!userData[senderId]) {
        await sock.sendMessage(from, { text: "❌ Anda belum memiliki akun. Gunakan perintah !create untuk membuat akun." });
        return;
    }

    const user = userData[senderId];
    const jobDetails = jobConfig[user.job] || {};
    const absencesPerDay = jobDetails.absencesPerDay || 0;
    const maxDailyEarnings = (jobDetails.salaryPerAbsence || 0) * absencesPerDay;
    const expForNextLevel = getExpForNextLevel(user.level);

    // show assets
    let assetList = "📦 Aset Anda:\n";
    if (user.assets && Object.keys(user.assets).length > 0) {
        for (const [assetName, amount] of Object.entries(user.assets)) {
            assetList += `- ${assetName}: ${amount}\n`;
        }
    } else {
        assetList += "Anda belum memiliki aset.\n";
    }

    await sock.sendMessage(from, { 
        text: `📊 Status Anda:\n` +
              `Level: ${user.level}\n` +
              `EXP: ${user.exp}/${expForNextLevel}\n` +
              `Uang: $${user.money}\n` +
              `Pekerjaan: ${user.job || "Belum ada"}\n` +
              `Hari terakhir bekerja: ${user.lastWork || "Belum pernah bekerja"}\n` +
              `Hari bolos: ${user.missedDays}\n` +
              `Absen hari ini: ${user.absenCount || 0}/${absencesPerDay}\n` +
              `Gaji harian: $${user.dailyEarnings || 0}/$${maxDailyEarnings}\n\n` +
              assetList
    });
    return;
}


if (body.startsWith("!judi")) {
    const senderId = msg.key.participant || msg.key.remoteJid;

    if (!userData[senderId]) {
        await sock.sendMessage(from, { text: "❌ Anda belum memiliki akun. Gunakan perintah !create untuk membuat akun." });
        return;
    }

    const user = userData[senderId];
    const args = body.split(" ");
    if (args.length < 3) {
        await sock.sendMessage(from, { text: "❌ Format salah! Gunakan: !judi [jumlah taruhan] [head/tail]" });
        return;
    }

    const betAmount = parseInt(args[1]);
    const choice = args[2].toLowerCase();

    if (isNaN(betAmount) || betAmount <= 0) {
        await sock.sendMessage(from, { text: "❌ Jumlah taruhan harus berupa angka positif." });
        return;
    }

    if (betAmount > user.money) {
        await sock.sendMessage(from, { text: `❌ Uang Anda tidak cukup! Anda hanya memiliki $${user.money}.` });
        return;
    }

    if (choice !== "head" && choice !== "tail") {
        await sock.sendMessage(from, { text: "❌ Pilihan harus 'head' atau 'tail'." });
        return;
    }

    // flip coin
    const outcomes = ["head", "tail"];
    const result = outcomes[Math.floor(Math.random() * outcomes.length)];

    if (choice === result) {
        const winnings = betAmount * 2;
        user.money += winnings;
        await sock.sendMessage(from, { text: `🎉 Selamat! Koin menunjukkan ${result}. Anda menang $${winnings}. Total uang Anda: $${user.money}.` });
    } else {
        user.money -= betAmount;
        await sock.sendMessage(from, { text: `❌ Sayang sekali! Koin menunjukkan ${result}. Anda kalah $${betAmount}. Total uang Anda: $${user.money}.` });
    }

    saveUserData();
    return;
}

if (body.startsWith("!togel")) {
    const senderId = msg.key.participant || msg.key.remoteJid;

    if (!userData[senderId]) {
        await sock.sendMessage(from, { text: "❌ Anda belum memiliki akun. Gunakan perintah !create untuk membuat akun." });
        return;
    }

    const user = userData[senderId];
    const args = body.split(" ");
    if (args.length < 3) {
        await sock.sendMessage(from, { text: "❌ Format salah! Gunakan: !togel [jumlah taruhan] [angka (2-4 digit)]" });
        return;
    }

    const betAmount = parseInt(args[1]);
    const chosenNumber = args[2];

    if (isNaN(betAmount) || betAmount <= 0) {
        await sock.sendMessage(from, { text: "❌ Jumlah taruhan harus berupa angka positif." });
        return;
    }

    if (betAmount > user.money) {
        await sock.sendMessage(from, { text: `❌ Uang Anda tidak cukup! Anda hanya memiliki $${user.money}.` });
        return;
    }

    if (!/^\d{2,4}$/.test(chosenNumber)) {
        await sock.sendMessage(from, { text: "❌ Angka harus berupa 2 hingga 4 digit (contoh: 12, 123, 1234)." });
        return;
    }

    const randomNumber = Math.floor(Math.random() * 10000).toString().padStart(4, "0"); // 4 digit angka acak
    console.log(`🎲 Angka yang diundi: ${randomNumber}`);

    // Hitung jumlah digit yang cocok tanpa memperhatikan urutan
    let matchCount = 0;
    let tempRandom = randomNumber; // Salinan untuk menghindari double count
    for (let digit of chosenNumber) {
        if (tempRandom.includes(digit)) {
            matchCount++;
            tempRandom = tempRandom.replace(digit, ""); // Hindari hitungan ganda
        }
    }

    // Hitung kemenangan berdasarkan jumlah kecocokan digit
    let winnings = 0;
    if (matchCount === 4) {
        winnings = betAmount * 100;
    } else if (matchCount === 3) {
        winnings = betAmount * 50;
    } else if (matchCount === 2) {
        winnings = betAmount * 10;
    } else if (matchCount === 1) {
        winnings = betAmount * 5;
    }

    // Menampilkan hasil kepada pemain
    if (winnings > 0) {
        user.money += winnings;
        await sock.sendMessage(from, { text: `🎉 Selamat! Angka yang diundi: ${randomNumber}. Anda menang $${winnings}. Total uang Anda: $${user.money}.` });
    } else {
        user.money -= betAmount;
        await sock.sendMessage(from, { text: `❌ Sayang sekali! Angka yang diundi: ${randomNumber}. Anda kalah $${betAmount}. Total uang Anda: $${user.money}.` });
    }

    saveUserData();
    return;
}

if (body.startsWith("!topup")) {
    const senderId = msg.key.participant || msg.key.remoteJid;

    // check if at group
    if (!isGroup) {
        await sock.sendMessage(from, { text: "❌ Perintah ini hanya dapat digunakan di grup." });
        return;
    }

    // checck admin
    const groupMetadata = await sock.groupMetadata(from);
    const isAdmin = groupMetadata.participants.some(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));

    if (!isAdmin) {
        await sock.sendMessage(from, { text: "❌ Perintah ini hanya dapat digunakan oleh admin grup." });
        return;
    }

    const args = body.split(" ");
    if (args.length < 3) {
        await sock.sendMessage(from, { text: "❌ Format salah! Gunakan: !topup [jumlah] [@tag atau nomor]" });
        return;
    }

    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0) {
        await sock.sendMessage(from, { text: "❌ Jumlah top-up harus berupa angka positif." });
        return;
    }

    if (amount > MAX_MONEY) {
        await sock.sendMessage(from, { text: `❌ Jumlah top-up tidak boleh lebih dari $${MAX_MONEY}.` });
        return;
    }

    let targetId;
    if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        // if tag at group
        targetId = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    } else if (/^\d+$/.test(args[2])) {
        // if number tp
        targetId = args[2] + "@s.whatsapp.net";
    } else {
        await sock.sendMessage(from, { text: "❌ Format salah! Gunakan: !topup [jumlah] [@tag atau nomor]" });
        return;
    }

    if (!userData[targetId]) {
        await sock.sendMessage(from, { text: "❌ Pengguna tidak ditemukan. Pastikan pengguna sudah memiliki akun." });
        return;
    }

    if ((userData[targetId].money || 0) + amount > MAX_MONEY) {
        await sock.sendMessage(from, { text: `❌ Total uang pengguna tidak boleh lebih dari $${MAX_MONEY}.` });
        return;
    }

    // add money
    userData[targetId].money = (userData[targetId].money || 0) + amount;
    saveUserData();

    await sock.sendMessage(from, { text: `✅ Berhasil menambahkan $${amount} ke akun ${targetId.replace("@s.whatsapp.net", "")}.` });
    await sock.sendMessage(targetId, { text: `💰 Anda telah menerima top-up sebesar $${amount} dari admin.` });
}

if (body.startsWith("!harga")) {
    let priceList = "📊 Harga Aset Saat Ini:\n";
    assets.forEach((asset, index) => {
        priceList += `${index + 1}. ${asset.name}: $${asset.price}\n`;
    });
    await sock.sendMessage(from, { text: priceList });
    return;
}

if (body.startsWith("!beli")) {
    const senderId = msg.key.participant || msg.key.remoteJid;

    if (!userData[senderId]) {
        await sock.sendMessage(from, { text: "❌ Anda belum memiliki akun. Gunakan perintah !create untuk membuat akun." });
        return;
    }

    const args = body.split(" ");
    if (args.length < 3) {
        await sock.sendMessage(from, { text: "❌ Format salah! Gunakan: !beli [nomor aset] [jumlah]" });
        return;
    }

    const assetIndex = parseInt(args[1]) - 1;
    const amount = args[2];

    const user = userData[senderId];
    
    if (amount.toLowerCase() === "all") {
        // Jika memilih 'all', beli sebanyak yang bisa dibeli dengan seluruh uang
        const asset = assets[assetIndex];
        const totalAmount = Math.floor(user.money / asset.price); // Hitung jumlah aset yang bisa dibeli
        if (totalAmount === 0) {
            await sock.sendMessage(from, { text: `❌ Uang Anda tidak cukup untuk membeli ${asset.name}.` });
            return;
        }

        user.money -= totalAmount * asset.price;
        user.assets = user.assets || {};
        user.assets[asset.name] = (user.assets[asset.name] || 0) + totalAmount;

        saveUserData();
        await sock.sendMessage(from, { text: `✅ Anda berhasil membeli ${totalAmount} ${asset.name} dengan seluruh uang Anda.` });
        return;
    }

    const amountParsed = parseInt(amount);
    if (isNaN(amountParsed) || amountParsed <= 0) {
        await sock.sendMessage(from, { text: "❌ Jumlah harus berupa angka positif." });
        return;
    }

    const asset = assets[assetIndex];
    const totalCost = asset.price * amountParsed;

    if (user.money < totalCost) {
        await sock.sendMessage(from, { text: `❌ Uang Anda tidak cukup! Total biaya: $${totalCost}. Uang Anda: $${user.money}.` });
        return;
    }

    user.money -= totalCost;
    user.assets = user.assets || {};
    user.assets[asset.name] = (user.assets[asset.name] || 0) + amountParsed;

    saveUserData();
    await sock.sendMessage(from, { text: `✅ Anda berhasil membeli ${amountParsed} ${asset.name} dengan total biaya $${totalCost}.` });
    return;
}

if (body.startsWith("!jual")) {
    const senderId = msg.key.participant || msg.key.remoteJid;

    if (!userData[senderId]) {
        await sock.sendMessage(from, { text: "❌ Anda belum memiliki akun. Gunakan perintah !create untuk membuat akun." });
        return;
    }

    const args = body.split(" ");
    if (args.length < 3) {
        await sock.sendMessage(from, { text: "❌ Format salah! Gunakan: !jual [nomor aset] [jumlah]" });
        return;
    }

    const assetIndex = parseInt(args[1]) - 1;
    const amount = args[2];

    const user = userData[senderId];

    if (amount.toLowerCase() === "all") {
        // Jika memilih 'all', jual semua aset yang dimiliki
        const asset = assets[assetIndex];
        if (!user.assets || !user.assets[asset.name]) {
            await sock.sendMessage(from, { text: `❌ Anda tidak memiliki ${asset.name} untuk dijual.` });
            return;
        }

        const totalAmount = user.assets[asset.name]; // Ambil semua aset yang dimiliki
        const totalEarnings = asset.price * totalAmount;

        // Kurangi aset pengguna dan tambah uang
        delete user.assets[asset.name];
        user.money += totalEarnings;

        saveUserData();
        await sock.sendMessage(from, { text: `✅ Anda berhasil menjual ${totalAmount} ${asset.name} dan mendapatkan $${totalEarnings}.` });
        return;
    }

    const amountParsed = parseInt(amount);
    if (isNaN(amountParsed) || amountParsed <= 0) {
        await sock.sendMessage(from, { text: "❌ Jumlah harus berupa angka positif." });
        return;
    }

    const asset = assets[assetIndex];
    if (!user.assets || !user.assets[asset.name] || user.assets[asset.name] < amountParsed) {
        await sock.sendMessage(from, { text: `❌ Anda tidak memiliki cukup ${asset.name} untuk dijual.` });
        return;
    }

    const totalEarnings = asset.price * amountParsed;

    // Kurangi aset pengguna dan tambah uang
    user.assets[asset.name] -= amountParsed;
    if (user.assets[asset.name] === 0) delete user.assets[asset.name];
    user.money += totalEarnings;

    saveUserData();
    await sock.sendMessage(from, { text: `✅ Anda berhasil menjual ${amountParsed} ${asset.name} dan mendapatkan $${totalEarnings}.` });
    return;
}

// Werewolf Game Functions (keep these at the top with other game functions)
// Werewolf Game Functions
const game = {
    roomActive: false,
    players: {}, // Menyimpan ID pemain dan nama
    werewolf: null,
    seer: null,
    villager: [],
    night: false,
    votes: {},
    timer: null,
    lastProcessed: {} // Untuk mencegah duplikasi pesan
};

// Fungsi utilitas
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Fungsi game
async function startRoom(sock, chatId) {
    if (game.roomActive) {
        await sock.sendMessage(chatId, { text: "Room sudah aktif! Gunakan !join untuk masuk." });
        return;
    }
    
    game.roomActive = true;
    game.players = {};
    await sock.sendMessage(chatId, { text: "🎮 Room Werewolf dibuat!\nGunakan !join untuk masuk ke game." });
}

async function joinGame(sock, chatId, userId, pushName) {
    if (!game.roomActive) {
        await sock.sendMessage(chatId, { text: "❌ Belum ada room aktif! Gunakan !werewolf untuk membuat room." });
        return;
    }
    
    if (game.players[userId]) {
        // Skip jika sudah join untuk hindari duplikasi pesan
        return;
    }
    
    game.players[userId] = {
        name: pushName,
        alive: true
    };
    
    await sock.sendMessage(chatId, { 
        text: `🎉 ${pushName} telah bergabung ke game!`,
        mentions: [userId]
    });
}

async function startGame(sock, chatId) {
    const playerIds = Object.keys(game.players);
    if (playerIds.length < 3) {
        await sock.sendMessage(chatId, { text: "❌ Minimal 3 pemain untuk memulai game!" });
        return;
    }

    // Reset game state
    game.werewolf = null;
    game.seer = null;
    game.villager = [];
    game.votes = {};
    
    shuffle(playerIds);
    game.werewolf = playerIds[0];
    game.seer = playerIds[1];
    game.villager = playerIds.slice(2);

    // Kirim peran ke pemain dengan delay
    try {
        await sock.sendMessage(game.werewolf, { 
            text: "🐺 Anda adalah WEREWOLF!\nGunakan !kill @target untuk membunuh pemain di malam hari." 
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await sock.sendMessage(game.seer, { 
            text: "🔮 Anda adalah SEER!\nGunakan !check @target untuk mengecek peran pemain di malam hari." 
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        for (const villagerId of game.villager) {
            await sock.sendMessage(villagerId, { 
                text: "👨‍🌾 Anda adalah VILLAGER!\nBantu temukan werewolf dan voting untuk menyingkirkannya di siang hari." 
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const mentions = playerIds.map(id => `@${game.players[id].name}`).join(" ");
        await sock.sendMessage(chatId, { 
            text: `🎮 Game Werewolf dimulai! Pemain:\n${mentions}\n\n🌙 Malam pertama dimulai...`,
            mentions: playerIds
        });
        
        game.night = true;
        startNightPhase(sock, chatId);
    } catch (error) {
        console.error("Gagal memulai game:", error);
        await sock.sendMessage(chatId, { text: "❌ Gagal memulai game. Coba lagi." });
    }
}

async function startNightPhase(sock, chatId) {
    game.votes = {}; // Reset votes setiap malam
    await sock.sendMessage(chatId, { text: "🌙 Malam tiba! Werewolf bangun dan pilih target..." });
    
    // Set timeout untuk fase malam (60 detik)
    game.timer = setTimeout(() => startDayPhase(sock, chatId), 60000);
}

async function startDayPhase(sock, chatId) {
    clearTimeout(game.timer);
    await sock.sendMessage(chatId, { text: "☀️ Siang tiba! Diskusikan dan voting untuk menyingkirkan werewolf..." });
    game.night = false;
    
    // Set timeout untuk fase siang (90 detik)
    game.timer = setTimeout(() => endDayPhase(sock, chatId), 90000);
}

async function endDayPhase(sock, chatId) {
    clearTimeout(game.timer);
    
    // Hitung hasil voting
    let maxVotes = 0;
    let executedPlayer = null;
    
    for (const [playerId, votes] of Object.entries(game.votes)) {
        if (votes > maxVotes) {
            maxVotes = votes;
            executedPlayer = playerId;
        }
    }
    
    if (executedPlayer) {
        const playerName = game.players[executedPlayer]?.name || "Unknown";
        await sock.sendMessage(chatId, { text: `⚰️ ${playerName} telah dihukum mati oleh warga!` });
        
        // Hapus pemain yang dihukum
        delete game.players[executedPlayer];
        
        // Cek kondisi kemenangan
        await checkWinCondition(sock, chatId);
    } else {
        await sock.sendMessage(chatId, { text: "Tidak ada pemain yang dihukum hari ini." });
        startNightPhase(sock, chatId);
    }
}

async function killPlayer(sock, chatId, killerId, targetId) {
    if (!game.night) {
        await sock.sendMessage(chatId, { text: "❌ Bisa membunuh hanya di malam hari!" });
        return;
    }
    
    if (game.werewolf !== killerId) {
        await sock.sendMessage(chatId, { text: "❌ Hanya werewolf yang bisa membunuh!" });
        return;
    }
    
    if (!game.players[targetId]?.alive) {
        await sock.sendMessage(chatId, { text: "❌ Target tidak valid atau sudah mati!" });
        return;
    }
    
    // Tandai pemain sebagai mati
    game.players[targetId].alive = false;
    const targetName = game.players[targetId].name;
    
    await sock.sendMessage(chatId, { 
        text: `🩸 ${targetName} telah dibunuh oleh werewolf!`,
        mentions: [targetId]
    });
    
    // Cek kondisi kemenangan
    await checkWinCondition(sock, chatId);
}

async function votePlayer(sock, chatId, voterId, targetId) {
    if (game.night) {
        await sock.sendMessage(chatId, { text: "❌ Voting hanya bisa dilakukan di siang hari!" });
        return;
    }
    
    if (!game.players[voterId]?.alive) {
        await sock.sendMessage(chatId, { text: "❌ Hanya pemain hidup yang bisa voting!" });
        return;
    }
    
    if (!game.players[targetId]?.alive) {
        await sock.sendMessage(chatId, { text: "❌ Tidak bisa memilih pemain yang sudah mati!" });
        return;
    }
    
    game.votes[targetId] = (game.votes[targetId] || 0) + 1;
    const voterName = game.players[voterId].name;
    const targetName = game.players[targetId].name;
    
    await sock.sendMessage(chatId, { 
        text: `🗳 ${voterName} memilih untuk menghukum ${targetName}!`,
        mentions: [voterId, targetId]
    });
}

async function checkPlayerRole(sock, chatId, seerId, targetId) {
    if (!game.night) {
        await sock.sendMessage(chatId, { text: "❌ Hanya bisa mengecek peran di malam hari!" });
        return;
    }
    
    if (game.seer !== seerId) {
        await sock.sendMessage(chatId, { text: "❌ Hanya seer yang bisa mengecek peran!" });
        return;
    }
    
    if (!game.players[targetId]) {
        await sock.sendMessage(chatId, { text: "❌ Target tidak valid!" });
        return;
    }
    
    let role;
    if (targetId === game.werewolf) {
        role = "WEREWOLF";
    } else if (targetId === game.seer) {
        role = "SEER";
    } else {
        role = "VILLAGER";
    }
    
    await sock.sendMessage(seerId, { 
        text: `🔮 Hasil pengecekan:\n${game.players[targetId].name} adalah ${role}`
    });
}

async function checkWinCondition(sock, chatId) {
    const alivePlayers = Object.entries(game.players)
        .filter(([_, player]) => player.alive)
        .map(([id]) => id);
    
    const aliveWerewolf = alivePlayers.includes(game.werewolf);
    const aliveVillagers = alivePlayers.filter(id => id !== game.werewolf).length;
    
    if (!aliveWerewolf) {
        await sock.sendMessage(chatId, { text: "🎉 PARA VILLAGER MENANG! Werewolf telah dikalahkan!" });
        await announceRoles(sock, chatId);
        resetGame();
        return;
    }
    
    if (aliveVillagers <= 1) {
        await sock.sendMessage(chatId, { text: "🐺 WEREWOLF MENANG! Hampir semua villager telah mati!" });
        await announceRoles(sock, chatId);
        resetGame();
        return;
    }
    
    // Lanjut ke fase berikutnya
    if (game.night) {
        startDayPhase(sock, chatId);
    } else {
        startNightPhase(sock, chatId);
    }
}

async function announceRoles(sock, chatId) {
    let roleList = "🔍 Peran Pemain:\n";
    
    for (const [id, player] of Object.entries(game.players)) {
        let role;
        if (id === game.werewolf) {
            role = "🐺 WEREWOLF";
        } else if (id === game.seer) {
            role = "🔮 SEER";
        } else {
            role = "👨‍🌾 VILLAGER";
        }
        
        roleList += `${player.name}: ${role}\n`;
    }
    
    await sock.sendMessage(chatId, { text: roleList });
}

function resetGame() {
    game.roomActive = false;
    game.players = {};
    game.werewolf = null;
    game.seer = null;
    game.villager = [];
    game.night = false;
    game.votes = {};
    clearTimeout(game.timer);
}

// Dalam message handler utama, tambahkan:
sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
        const msg = messages[0];
        if (!msg.message) return;

        const chatId = msg.key.remoteJid;
        const senderId = msg.key.participant || chatId;
        const body = msg.message.conversation || 
                    msg.message.extendedTextMessage?.text || "";
        const isGroup = chatId.endsWith('@g.us');
        const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];

        // ... (handler perintah lainnya)

        // Handler game Werewolf
        const command = body.toLowerCase().split(' ')[0];
        
        //Bahaya jirr wereWolf

        // if (command === "!werewolf") {
        //     await startRoom(sock, chatId);
        // } 
        // else if (command === "!join") {
        //     await joinGame(sock, chatId, senderId, msg.pushName);
        // }
        // else if (command === "!startwolf") {
        //     await startGame(sock, chatId);
        // }
        // else if (command === "!kill" && mentions.length > 0) {
        //     await killPlayer(sock, chatId, senderId, mentions[0]);
        // }
        // else if (command === "!vote" && mentions.length > 0) {
        //     await votePlayer(sock, chatId, senderId, mentions[0]);
        // }
        // else if (command === "!check" && mentions.length > 0) {
        //     await checkPlayerRole(sock, chatId, senderId, mentions[0]);
        // }

    } catch (error) {
        console.error("Error handling message:", error);
    }
});


        } catch (error) {
            console.error("❌ Error di event messages.upsert:", error);
        }
    });

    

    //(handle reconnect otomatis)
    sock.ev.on("connection.update", (update) => {
        console.log("🔄 Update koneksi:", update);
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("✅ Bot berhasil terhubung!");
        } else if (connection === "close") {
            console.log("⚠️ Koneksi terputus! Mencoba reconnect...");
            if (lastDisconnect?.error?.output?.statusCode !== 401) {
                startBot();
            } else {
                console.log("❌ Autentikasi gagal, hapus folder 'session' lalu coba scan ulang.");
            }
        }
    });

    sock.ev.on("qr", (qr) => {
        console.log("📸 Scan QR ini untuk login!");
    });
    
    setInterval(updateAssetPrices, 30000); // 3 detik
    setInterval(saveAssetPrices, 30000); //simpan harga 3detik 1x

}


startBot(); 