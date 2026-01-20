let currentQuestion = null;

async function getRandomPerkalian(sock, from) {
    const angka1 = Math.floor(Math.random() * 100) +1;
    const angka2 = Math.floor(Math.random() * 100) +1;
    const hasil = angka1 * angka2;

    currentQuestion = { angka1, angka2, hasil };

    await sock.sendMessage(from, { text: `Berapakah hasil dari ${angka1} x ${angka2} ?\nKirim jawaban dengan format: !j <jawaban>` });
}

async function cekjawaban(query, sock, from) {
    if(currentQuestion === null) {
        await sock.sendMessage(from, { text: 'Tidak ada soal yang sedang aktif. Gunakan perintah !Perkalian untuk memulai.' });
        return;
    }

    const jawaban = query.split(' ')[1];

    if(!jawaban) {
        await sock.sendMessage(from, { text: 'Format jawaban salah. Gunakan format: !j <jawaban>' });
        return;
    }

    if(parseInt(jawaban) === currentQuestion.hasil) {
        await sock.sendMessage(from, { text: '🎉 Jawaban benar!' });
    } else {
        await sock.sendMessage(from, { text: `❌ Jawaban salah! Hasil yang benar adalah ${currentQuestion.hasil}.` });
    }
    
}

module.exports = { getRandomPerkalian, cekjawaban };