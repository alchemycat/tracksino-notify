import axios from "axios";

class Telegram {
	constructor(token, chatID) {
		this.token = token;
		this.chatID = chatID;
	}

	async sendMessage(message) {
		await axios.post(`https://api.telegram.org/bot${this.token}/sendMessage`, {
			chat_id: this.chatID,
			text: message,
			parse_mode: "HTML",
			disable_web_page_preview: true
		});
	}
}

export default Telegram;
