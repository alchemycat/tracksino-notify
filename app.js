import axios from "axios";
import fs from "fs";
import path from "path";
import EventEmmiter from "events";
import chalk from "chalk";

import Telegram from "./lib/Telegram.js";

import { parse } from "node-html-parser";

async function main() {
	const config = {};
	let token = null;
	let chatId = null;
	let timeout = null;
	let gamesLength = 0;

	const __dirname = path.resolve();

	const configPath = path.resolve(`${__dirname}/config.txt`);

	if (!fs.existsSync(configPath))
		return console.log(
			`Ошибка: ${chalk.bold.red("Не найден файл config.txt")}`,
		);

	const configContent = fs.readFileSync(configPath, "utf8");

	if (!configContent)
		return console.log(`Ошибка: ${chalk.bold.red("файл config.txt пуст")}`);

	let list;

	list = configContent.split(/\r?\n/);

	if (!list.length)
		return console.log(`Ошибка: ${chalk.bold.red("файл config.txt пуст")}`);

	list = list.filter((item) => item !== "");

	function checkString(content, string) {
		return content.includes(string);
	}

	let validation = null;

	validation = checkString(configContent, "Таймаут:");
	if (!validation)
		return console.log(
			`Ошибка: ${chalk.bold.red("Не указан таймаут в настройках")}`,
		);
	validation = checkString(configContent, "Токен:");
	if (!validation)
		return console.log(
			`Ошибка: ${chalk.bold.red("Не указан телеграм токен в настройках")}`,
		);
	validation = checkString(configContent, "Чата:");
	if (!validation)
		return console.log(
			`Ошибка: ${chalk.bold.red("Не указан ID чата телеграм в настройках")}`,
		);
	validation = checkString(configContent, "Название:");
	if (!validation)
		return console.log(
			`Ошибка: ${chalk.bold.red("В файле настроек нету игр для проверки")}`,
		);

	for (const string of list) {
		try {
			if (string.includes("Токен")) {
				token = string.split(":");
				if (token.length != 3) {
					return console.log(
						`Ошибка: ${chalk.bold.red(
							"Неправильный формат токена. Пример: Токен:123456789:ABCDEF",
						)}`,
					);
				}
				token = token[1] + ":" + token[2];
			} else if (string.includes("Чата")) {
				chatId = string.split(":");

				if (chatId.length != 2 || !chatId[1]) {
					return console.log(
						`Ошибка: ${chalk.bold.red(
							"Неправильный формат ID чата. Пример: ID-Чата:123456789",
						)}`,
					);
				}

				chatId = chatId[1];
			} else if (string.includes("Таймаут")) {
				timeout = string.split(":");
				if (timeout.length != 2 || !timeout[1]) {
					return console.log(
						`Ошибка: ${chalk.bold.red(
							"Неправильный формат таймаута. Пример: Таймаут:5",
						)}`,
					);
				}
				timeout = timeout[1];
			} else {
				let row = string.split(";");

				if (row.length != 3)
					return console.log(
						`Ошибка: ${chalk.bold.red(
							"Неправильный формат строки для игр. Пример: Название:Рандомая Игра;Карточки:1;Проценты:25",
						)}`,
					);

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

				let colCards;
				try {
					colCards = row[1].split(":")[1].split(",");
				} catch {
					return console.log(
						`Игра: ${chalk.bold.yellow(colName)} Ошибка: ${chalk.bold.red(
							"не указаны карточки",
						)}`,
					);
				}

				if (!colCards.length || !colCards[0])
					return console.log(
						`Игра: ${chalk.bold.yellow(colName)} Ошибка: ${chalk.bold.red(
							"не указаны карточки",
						)}`,
					);

				colCards = colCards.map((item) => item.trim());
				colCards = colCards.filter((item) => item !== "");

				let colPercents;

				try {
					colPercents = row[2].split(":")[1].split(",");
				} catch {
					return console.log(
						`Игра: ${chalk.bold.yellow(colName)} Ошибка: ${chalk.bold.red(
							"не указаны проценты",
						)}`,
					);
				}

				if (!colPercents.length || !colPercents[0])
					return console.log(
						`Игра: ${chalk.bold.yellow(colName)} Ошибка: ${chalk.bold.red(
							"не указаны проценты",
						)}`,
					);

				colPercents = colPercents.map((item) => item.trim());
				colPercents = colPercents.filter((item) => item !== "");
				colPercents = colPercents.map((item) => parseFloat(item));

				if (colCards.length != colPercents.length)
					return console.log(
						`Игра: ${chalk.bold.yellow(colName)} Ошибка: ${chalk.bold.red(
							"не равное количество карточек и процентов",
						)}`,
					);

				config[colName].cards = [];

				for (let i = 0; i < colCards.length; i++) {
					const name = colCards[i];
					const limit = colPercents[i];
					config[colName].cards.push({ name, limit });
				}
			}
		} catch (err) {
			console.log(err);
		}
	}

	if (!token)
		return console.log(`Ошибка: ${chalk.bold.red("Не указан телеграм токен")}`);

	if (!chatId)
		return console.log(
			`Ошибка: ${chalk.bold.red("Не указан ID чата телеграм")}`,
		);

	if (!timeout)
		return console.log(`Ошибка: ${chalk.bold.red("Не указан таймаут")}`);

	gamesLength = Object.keys(config).length;

	if (!gamesLength)
		return console.log(`Ошибка: ${chalk.bold.red("Не указаны игры")}`);

	const telegram = new Telegram(token, chatId);
	const emitter = new EventEmmiter();

	const games = config;
	let percents = [];
	let requests = [];

	emitter.on("complete", async (result) => {
		if (!Array.isArray(result) || !result.length) {
			return console.log(
				chalk.bold.red("Подходящих результатов для игр не найдено"),
			);
		}
		// if (!result.length)

		try {
			let resultMessage = "Подходящие карточки:";
			for (const game in games) {
				const { url, cards } = games[game];
				const gameResult = result.filter((item) => item.game === game);
				resultMessage += `\nИгра: <b><a href="${url}">${game}</a></b>`;
				let isCardFinded = false;

				for (let i = 0; i < cards.length; i++) {
					const card = cards[i];

					let { name, limit } = card;

					let cardPercent = gameResult.find((item) => item[name]);

					if (!cardPercent) continue;

					cardPercent = cardPercent[name];

					limit = parseFloat(limit);
					cardPercent = parseFloat(cardPercent);

					if (cardPercent < limit) {
						isCardFinded = true;
						resultMessage += `\nКарточка: "<b>${name}</b>" Желаемый: <b>${cardPercent}%</b>`;
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
				console.log(chalk.bold.green(`Отправляю результаты в телеграм`));
				await telegram.sendMessage(resultMessage);
			} else {
				console.log(
					chalk.bold.red("Подходящих результатов для игр не найдено"),
				);
			}
		} catch (err) {
			console.log(err);
		}
	});

	function makeRequest(games, callback) {
		for (const game in games) {
			const { url, cards } = games[game];
			console.log(`Запрос данных для игры: ${chalk.bold.yellow(game)}`);
			axios
				.get(url)
				.then((response) => {
					if (response.status === 200) {
						callback(response.data, cards, game);
					} else {
						throw new Error(
							`Игра: ${game} Ошибка: статус код ${chalk.bold.red(
								response.status,
							)}`,
						);
					}
				})
				.catch((err) => {
					console.log(err);
					callback(null); // Прекратить повторы и вернуть null
				});
		}
	}

	function handleResponse(data, cards, game) {
		try {
			if (!data) throw new Error("No data returned");

			requests.push(true);

			let root;

			root = parse(data);

			let title = root.querySelector(".card-title");

			if (title.textContent === "No Data Found") {
				console.log(
					`Нет данных за выбранный период, игра: ${chalk.bold.yellow(game)} `,
				);
			} else {
				if (game === "Lightning Roulette") {
					const rates = root.querySelectorAll(".rate");

					if (!Array.isArray(rates) || !rates.length)
						throw new Error(`Rates not found`);

					let finded = [];

					rates.pop(); // remove last element

					if (!rates.length) throw new Error(`Rates not found`);

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
						percents.push({ game, any: value.toFixed(2) });
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
			}

			if (requests.length >= gamesLength) {
				emitter.emit("complete", percents);
			}
		} catch (err) {
			// console.log(err);
			console.log(
				`Игра: ${chalk.bold.yellow(
					game ? game : "ошибка названия",
				)} Ошибка: ${chalk.bold.red(err.message)}`,
			);
		}
	}

	//запуск чекера
	console.log("Чекер запущен");

	setInterval(() => {
		percents = [];
		requests = [];
		makeRequest(games, handleResponse);
	}, timeout * 1000);
}

main();
