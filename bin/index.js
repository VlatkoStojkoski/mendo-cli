#! /usr/bin/env node

import { Command } from 'commander';
const program = new Command();

import login from "./login.js";
import logout from "./logout.js";
import watch from "./watch.js";

program
	.name('mendo')
	.description('This CLI utilises the Mendo API for competitve programming.')
	.version('0.0.1');

program
	.command('login')
	.description('Logs into Mendo')
	.action(login);

program
	.command('logout')
	.description('Log out of Mendo')
	.action(logout);

program
	.command('watch')
	.description('Watch code and submit on save')
	.argument('<filename>', 'filename of the file to watch')
	.argument('<compile path>', 'filename of the compiled file')
	.argument('<task id>', 'task id to submit to')
	.option('--examples-only', 'only test examples without submitting')
	.option('--test', 'force to submit even if examples are wrong')
	.action(watch);

program.parse();