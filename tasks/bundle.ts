import { bundle } from 'https://deno.land/x/emit@0.40.0/mod.ts';

const src_dir = './src';
const dist_dir = './dist';

const exists = async (src: string) => await Deno.stat(src).catch(() => false);

const bundle_file = async (name: string) => {
  const src = `${src_dir}/${name}`;
  const dist = `${dist_dir}/${name.replace('.ts', '.js')}`;
  // reutnr if file does not exist
  if (!await exists(src)) {
    console.log(`File ${src} does not exist`);
    return;
  }

  const result = await bundle(src);
  const { code } = result;
  Deno.writeTextFileSync(dist, code);
};

bundle_file('background.ts');
bundle_file('content.ts');
bundle_file('popup.ts');
bundle_file('settings.ts');
