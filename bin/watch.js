// filesystem imports
import { watch as _watch } from 'chokidar';
import { writeFileSync, createReadStream } from 'fs';
import Configstore from 'configstore';
import tmp from 'tmp';

// cli decorations imports
import inquirer from 'inquirer';
import { table } from 'table';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';

// api imports
import { MendoClient, Task } from 'mendo-private-api';

import { promisify } from 'util';
import { exec as _exec } from 'child_process';

const exec = promisify(_exec);

export default async function watch(filename, outputFile, taskId, options) {
	options = options || {};

	const config = new Configstore('mendo');
	const savedCookie = config.get('cookie');

	const mendoClient = new MendoClient(savedCookie);

	if (!mendoClient.getCookie()) {
		console.log(chalk.red('Not logged in!'));
		return;
	}

	const task = new Task({ id: taskId });
	await task.extract(['examples', 'content']);

	console.log(
		boxen(
			[
				`${chalk.blackBright(`${task.content.description.slice(0, 100)}...`)}`,
				`Input:\n${task.content.input}`,
				`Output:\n${task.content.output}`,
				chalk.yellow(
					'Constraints:\n' +
					Object.entries(task.content.constraints).map(
						([key, value]) => `${key[0].toUpperCase() + key.slice(1)}: ${value}`
					).join('\n')
				)
			]
				.map(
					line => line.match(
						new RegExp(
							`.{1,${Math.min(50, process.stdout.columns - 5)}}`,
							'g'
						)
					).join('\n')
				)
				.join('\n\n') + '\n',
			{
				title: task.content.name
			}
		)
	);

	const spinner = ora('Watching for file change...').start();

	const resetWatcher = async () => {
		fsWatcher.close();

		const answers = await inquirer.prompt([
			{
				type: 'confirm',
				name: 'continue',
				message: 'Continue watching?',
				default: true
			}
		]);

		if (answers.continue) {
			console.clear();
			watch(filename, outputFile, taskId);
		}
	}

	const submitCode = async (path) => {
		try {
			spinner.succeed();

			console.log(chalk.blue('\nSubmitting code...\n'));

			await exec(`g++ -O2 -std=c++11 -o ${outputFile} ${filename}`);

			for (const [exampleI, example] of task.content.examples.entries()) {
				const input = example.input.match(/(?<=влез\n).*/s)[0];
				const tmpFile = tmp.fileSync({ postfix: '.in' });
				writeFileSync(tmpFile.name, input);

				const { stdout: outStdout } = await exec(`${outputFile} < ${tmpFile.name}`);
				const output = outStdout.trim();

				const exampleOutput = example.output.match(/(?<=излез\n).*/s)[0];

				const debugInfo = [
					[`Input:\n${input}`, chalk.bgGrey],
					[`Expected:\n${exampleOutput}`, chalk.bgBlueBright.black],
					[`Got:\n${output}`, chalk.bgBlue]
				];

				const examplesString =
					debugInfo
						.map(([str, color]) => str.split('\n').map((s) => [s, color]))
						.reduce((acc, cur) => acc.concat(cur), [])
						.map(([line, color], lineI, lines) => {
							const maxWidth = Math.max(...(lines.map(([l]) => l.length)));
							const padding = ' '.repeat(maxWidth - line.length);
							return color(` ${line}${padding} `);
						})
						.join('\n');

				const passedColor = output === exampleOutput ? chalk.bgGreenBright.black : chalk.bgRedBright.black;
				console.log(
					boxen(
						examplesString,
						{
							title: passedColor(`Example #${exampleI + 1}:`),
							borderColor: 'white',
							borderStyle: 'round',
							padding: {
								left: 1,
								top: 1
							},
							titleAlignment: 'center',
						}
					)
				);

				if (!(output === exampleOutput) && !options.test)
					return console.error(chalk.red(`Example #${exampleI + 1} failed!`));
			}

			if (options.examplesOnly)
				return;

			const codeStream = createReadStream(path);
			await mendoClient.sendSubmission({
				task,
				code: codeStream,
				interval: 250
			});

			process.stdout.write("\r\x1b[K");

			await task.extract(['examples']);

			const res = task.sentSubmissions[0];

			if (res.url.includes('NotLoggedIn')) {
				console.error(chalk.red('Not logged in!\n'));
				process.exit(1);
			}

			const passingRatio = res.tests.filter((t) => t.passed).length / res.tests.length;

			const passedColor = chalk.rgb(255 * (1 - passingRatio), 255 * passingRatio, 0);

			const tableData = res.tests.map((t, tI) => [
				tI + 1,
				t.message,
				t.passed ? chalk.green('✔') : chalk.red('✖'),
			]);

			await task.extract(['content']);

			console.log(
				table(tableData, {
					columns: {
						0: {
							width: 2
						},
						1: {
							width: 35
						},
						2: {
							width: 1,
							alignment: 'center'
						}
					},
					header: {
						alignment: 'center',
						content: `${task.content.name} (${passedColor(res.passedTests)})`,
					}
				})
			);
		} catch (error) {
			console.log(error?.response?.data || error);
			console.error(chalk.red(error.toString()));
		}
	}

	const fsWatcher = _watch(filename, {
		awaitWriteFinish: {
			stabilityThreshold: 2000,
			pollInterval: 100
		}
	}).on('change', async (...args) => {
		await submitCode(...args);
		await resetWatcher();
	});
}
