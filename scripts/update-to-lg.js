const fs = require('fs');
const { execSync } = require('child_process');

try {
  const cmd = `git grep -l "rounded-xl" | grep -E "admin|backyard|components/admin|dashboard"`;
  const files = execSync(cmd, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);

  let updatedCount = 0;

  for (const file of files) {
    if (!fs.existsSync(file)) continue;

    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('rounded-xl')) {
      content = content.replace(/rounded-xl/g, 'rounded-lg');
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Updated ${file}`);
      updatedCount++;
    }
  }

  console.log(`\nSuccessfully updated ${updatedCount} files to rounded-lg.`);
} catch (e) {
  console.error('Error:', e.message);
}
