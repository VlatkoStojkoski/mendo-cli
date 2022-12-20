import { MendoClient } from 'mendo-private-api';
import Configstore from 'configstore';
import chalk from 'chalk';

export default async function logout() {
	const config = new Configstore('mendo');
	const savedCookie = config.get('cookie');

	try {
		const mendoClient = new MendoClient(savedCookie);

		config.delete('cookie');

		console.log(chalk.green('Logged out.'));
	} catch (error) {
		console.error(error);
	}
}
