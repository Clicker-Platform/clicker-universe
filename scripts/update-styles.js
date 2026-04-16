const fs = require('fs');
const { execSync } = require('child_process');

try {
  // Get all files containing rounded-2xl or shadow-sm
  const cmd = `git grep -l -E "rounded-2xl|shadow-sm" | grep -E "admin|backyard|components/admin|dashboard"`;
  const files = execSync(cmd, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);

  let updatedCount = 0;

  for (const file of files) {
    if (!fs.existsSync(file)) continue;

    let content = fs.readFileSync(file, 'utf8');
    let hasChanges = false;

    // Replace rounded-2xl with rounded-xl
    if (content.includes('rounded-2xl')) {
      content = content.replace(/rounded-2xl/g, 'rounded-xl');
      hasChanges = true;
    }

    // Replace shadow-sm with nothing, and clean up potential double spaces inside classNames
    if (content.includes('shadow-sm')) {
      // Regex to handle shadow-sm and any immediate surrounding trailing space
      content = content.replace(/\s+shadow-sm/g, ''); 
      content = content.replace(/shadow-sm\s+/g, '');
      content = content.replace(/shadow-sm/g, '');
      hasChanges = true;
    }

    if (hasChanges) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Updated ${file}`);
      updatedCount++;
    }
  }

  console.log(`\nSuccessfully updated ${updatedCount} files.`);
} catch (e) {
  console.error('Error:', e.message);
}
