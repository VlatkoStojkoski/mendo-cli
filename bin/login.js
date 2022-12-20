import { MendoClient } from 'mendo-private-api';
import Configstore from 'configstore';
import inquirer from 'inquirer';
import chalk from 'chalk';

export default async function login() {
	const config = new Configstore('mendo');
	const savedCookie = config.get('cookie');

	const mendoClient = new MendoClient(savedCookie);

	if (savedCookie) {
		console.log(chalk.green('Already logged in.'));

		const { login } = await inquirer.prompt([
			{
				type: 'confirm',
				name: 'login',
				message: 'Would you like to log in and delete current session?',
			}
		]);

		if (!login)
			return;
	}

	const { username, password } = await inquirer.prompt([
		{
			type: 'input',
			name: 'username',
			message: 'Username:',
		},
		{
			type: 'password',
			name: 'password',
			message: 'Password:',
		}
	]);

	try {
		await mendoClient.login({
			username,
			password,
		});
		console.log(chalk.green('Login successful!'));
	} catch (err) {
		console.error(chalk.red(err.toString()));
		return;
	}

	const cookie = mendoClient.getCookie();

	config.set('cookie', cookie);

	console.log(`Logged in with ${cookie}`);
}
