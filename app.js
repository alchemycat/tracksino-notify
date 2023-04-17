import axios from "axios";
import fs from "fs";
import path from "path";
import EventEmmiter from "events";
import logUpdate from "log-update";
import chalk from "chalk";

import Telegram from "./lib/Telegram.js";

import { parse } from "node-html-parser";

//?period=1hour
//?period=3hour

async function main() {
	const __dirname = path.resolve();
	const configPath = path.resolve(`${__dirname}/config.txt`);

	if (!fs.existsSync(configPath))
		return console.log("Не найден файл config.txt");

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
	// let cardsLength = configContent.includes("Lightning Roulette") ? 1 : 0;
	let cardsLength = 0;
	let token = null;
	let chatId = null;
	let timeout = null;

	for (const string of list) {
		try {
			if (string.includes("Токен")) {
				token = string.split(":")[1] + ":" + string.split(":")[2];
			} else if (string.includes("Чата")) {
				chatId = string.split(":")[1];
			} else if (string.includes("Таймаут")) {
				timeout = string.split(":")[1];
			} else {
				let row = string.split(";");

				let colName = row[0].split(":")[1];

				config[colName] = {};

				if (colName === "Monopoly") {
					config[colName].url = "https://tracksino.com/monopoly?period=1hour";
				} else if (colName === "Crazy Time") {
					config[colName].url = "https://tracksino.com/crazytime?period=1hour";
				} else if (colName === "Dream Catcher") {
					config[colName].url =
						"https://tracksino.com/dreamcatcher?period=1hour";
				} else if (colName === "Lightning Roulette") {
					config[colName].url =
						"https://tracksino.com/lightning-roulette?period=3hours";
				}

				let colCards = row[1].split(":")[1].split(",");
				let colPercents = row[2].split(":")[1].split(",");

				config[colName].cards = [];

				for (let i = 0; i < colCards.length; i++) {
					const name = colCards[i];
					const limit = colPercents[i];
					config[colName].cards.push({ name, limit });
				}

				cardsLength += config[colName].cards.length;
			}
		} catch (err) {
			console.log(err);
		}
	}

	if (!token) return console.log("Не указан телеграм токен");

	if (!chatId) return console.log("Не указан ID чата телеграм");

	if (!timeout) return console.log("Не указан таймаут");

	const telegram = new Telegram(token, chatId);
	const emitter = new EventEmmiter();

	const games = config;
	let percents = [];

	emitter.on("complete", async (result) => {
		if (!result.length) return console.log("Нет данных");

		let resultMessage = "Подходящие карточки:";
		for (const game in games) {
			const { url, cards } = games[game];
			const gameResult = result.filter((item) => item.game === game);
			resultMessage += `\nИгра: <b><a href="${url}">${game}</a></b>`;
			let isCardFinded = false;

			for (let i = 0; i < cards.length; i++) {
				const card = cards[i];

				let { name, limit } = card;

				let cardPercent = gameResult.find((item) => item[name])[name];

				limit = parseFloat(limit);
				cardPercent = parseFloat(cardPercent);

				if (cardPercent < limit) {
					isCardFinded = true;
					resultMessage += `\nКарточка: "<b>${name}</b>" Желаемый: <b>${cardPercent}%</b>`;
					// console.log(
					// 	`Игра: ${game} Карточка:${name} Желаемый: ${cardPercent}%`,
					// );
				}
			}

			if (!isCardFinded) {
				resultMessage = resultMessage.replace(
					`\nИгра: <b><a href="${url}">${game}</a></b>`,
					"",
				);
			}
		}
		if (resultMessage.includes("Карточка")) {
			// console.log("Отправляю результаты в телеграм");
			logUpdate(
				`Запрос данных с сайта: ${chalk.bold.yellow(
					"tracksino.com",
				)}, Результат: ${chalk.bold.bgGreen("отправка в телеграм")}`,
			);
			await telegram.sendMessage(resultMessage);
		} else {
			logUpdate(
				`Запрос данных с сайта: ${chalk.bold.yellow(
					"tracksino.com",
				)}, Результат: ${chalk.bold.bgMagenta("не найдено")}`,
			);
			// console.log("Нет результатов");
		}
	});

	function makeRequest(games, callback) {
		for (const game in games) {
			const { url, cards } = games[game];

			axios
				.get(url)
				.then((response) => {
					if (response.status === 200) {
						callback(response.data, cards, game);
					} else {
						throw new Error(`Server returned status code ${response.status}`);
					}
				})
				.catch((err) => {
					callback(null); // Прекратить повторы и вернуть null
				});
		}
	}

	function handleResponse(data, cards, game) {
		let root;

		try {
			root = parse(data);
			if (game === "Lightning Roulette") {
				const rates = root.querySelectorAll(".rate");
				let finded = [];
				rates.pop(); // remove last element
				for (const rate of rates) {
					let rateValue = rate.textContent;
					let percent = parseFloat(rateValue); //finded percent
					let myPercent = parseFloat(cards[0].limit); // config percent
					if (percent < myPercent) {
						finded.push(percent);
					}
				}

				if (finded.length) {
					const value = Math.min(...finded);
					percents.push({ game, any: value });
				} else {
					percents.push({ game, any: "100" });
				}
			} else {
				for (const card of cards) {
					let target = null;

					card.name.includes("Bonus")
						? (target = `${card.name} Segment`)
						: (target = `${game} ${card.name} Segment`);

					const image = root.querySelector(`img[alt="${target}"]`);

					if (!image) throw new Error("Image not found");

					const parent = image.parentNode;

					if (!parent) throw new Error("Parent not found");

					const title = parent.querySelector(".title");

					if (!title) throw new Error("Title not found");

					let percent = title.textContent;

					if (!percent || !percent.includes("%"))
						throw new Error("Percent not found");

					percent = parseFloat(percent).toFixed(2);

					percents.push({ game, [card.name]: percent });
				}
			}

			if (percents.length === cardsLength) {
				emitter.emit("complete", percents);
			}
		} catch (err) {
			console.log(err.message);
		}
	}

	//запуск чекера
	console.log("Чекер запущен");

	setInterval(() => {
		logUpdate(
			`Запрос данных с сайта: ${chalk.bold.yellow(
				"tracksino.com",
			)}, Результат: ${chalk.bold.bgYellow("ожидайте...")}`,
		);
		// console.log("Запрос данных с сайта: tracksino.com");
		percents = [];
		makeRequest(games, handleResponse);
	}, timeout * 1000);
}

main();
