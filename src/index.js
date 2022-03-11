import { program } from 'commander';
import action from './action.js';
program.version(process.env.npm_package_version);
program
    .command('start')
    .description('开始查找gpg靓号')
    .option('-p, --process <number>', '线程数', 1)
    .option('-b, --url <backid>', '指定通知使用的url')
    .action((options) => {
        action.generate(options.process, options.url);
    });
program
    .command('list [suffix]')
    .description('显示已经保存的数据')
    .action((suffix) => {
        action.list(suffix);
    });
program
    .command('import <suffix>')
    .description('导入靓号结果到gpg中')
    .option('-n, --name <name>', '指定uid.name', 'auto_generate')
    .option('-e, --email <email>', '指定uid.email')
    .option('-m, --comment <comment>', '指定uid.comment')
    .action((suffix, options) => {
        action.import(suffix, { name: options.name, email: options.email, comment: options.comment });
    });
program.parse();
