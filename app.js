const axios = require("axios");
const fs = require("fs");
const path = require("path");
const EventEmmiter = require("events");

const { Telegram } = require("./lib/Telegram");

const { parse } = require("node-html-parser");

const configPath = path.resolve(`${__dirname}/config.txt`);

if (!fs.existsSync(configPath)) return console.log("Не найден файл config.txt");

const configContent = fs.readFileSync(configPath, "utf8");

if (!configContent) return console.log("Файл config.txt пуст");

let list;

if (/\r/.test(configContent)) {
	list = configContent.split("\r");
} else {
	list = configContent.split("\n");
}

if (!list.length) return console.log("Файл config.txt пуст");

let config = {};
let cardsLength = 0;
let token = null;
let chatId = null;
let timeout = null;

for (const string of list) {
	if (string.includes("Токен")) {
		token = string.split(":")[1] + ":" + string.split(":")[2];
	} else if (string.includes("Чата")) {
		chatId = string.split(":")[1];
	} else if (string.includes("Таймаут")) {
		timeout = string.split(":")[1];
	} else {
		let row = string.split(";");

		let colName = row[0].split(":")[1];
		let colCards = row[1].split(":")[1].split(",");
		let colPercents = row[2].split(":")[1].split(",");

		config[colName] = {};

		if (colName === "Monopoly") {
			config[colName].url = "https://tracksino.com/monopoly";
		} else if (colName === "Crazy Time") {
			config[colName].url = "https://tracksino.com/crazytime";
		} else if (colName === "Dream Catcher") {
			config[colName].url = "https://tracksino.com/dreamcatcher";
		}

		config[colName].cards = [];

		for (let i = 0; i < colCards.length; i++) {
			const name = colCards[i];
			const limit = colPercents[i];
			config[colName].cards.push({ name, limit });
		}

		cardsLength += config[colName].cards.length;
	}
}

if (!token) return console.log("Не указан телеграм токен");

if (!chatId) return console.log("Не указан ID чата телеграм");

if (!timeout) return console.log("Не указан таймаут");

const telegram = new Telegram(token, chatId);

//?period=1hour
//?period=3hour

async function main(config) {
	const games = config;

	const emitter = new EventEmmiter();

	emitter.on("complete", async (result) => {
		for (const game in games) {
			const { url, cards } = games[game];
			const gameResult = result.filter((item) => item.game === game);
			let resultMessage = `Игра: <b><a href="${url}">${game}</a></b>`;

			for (let i = 0; i < cards.length; i++) {
				const card = cards[i];

				const { name, limit } = card;
				const cardPercent = gameResult.find((item) => item[name])[name];
				if (cardPercent < limit) {
					resultMessage += `\nКарточка: "<b>${name}</b>" Желаемый: <b>${cardPercent}%</b>`;
					console.log(
						`Игра: ${game} Карточка:${name} Текущий: ${cardPercent}% Ваш: ${limit}%`,
					);
				}
			}
			if (resultMessage.includes("Карточка")) {
				await telegram.sendMessage(resultMessage);
			}
		}
	});

	function handleRequests() {
		const percents = [];

		for (const game in games) {
			const { url, cards } = games[game];

			axios
				.get(url)
				.then((response) => {
					let data = response.data;
					const root = parse(data);

					for (const card of cards) {
						let target = null;

						card.name.includes("Bonus")
							? (target = `${card.name} Segment`)
							: (target = `${game} ${card.name} Segment`);

						const image = root.querySelector(`img[alt="${target}"]`);

						if (!image) return new Error("Image not found");

						const parent = image.parentNode;
						const title = parent.querySelector(".title");

						if (!title) return new Error("Title not found");

						let percent = title.textContent;

						if (!percent || !percent.includes("%")) return;

						percent = parseFloat(percent).toFixed(2);

						percents.push({ game, [card.name]: percent });

						if (percents.length === cardsLength) {
							emitter.emit("complete", percents);
						}
					}
				})
				.catch((err) => {
					console.log(err);
				});
		}
	}

	//запуск чекера
	setInterval(() => {
		console.log("Запрос отправлен");
		handleRequests();
	}, timeout * 1000);
}

main(config);
