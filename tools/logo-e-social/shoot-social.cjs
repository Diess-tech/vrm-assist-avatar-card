// Immagine social (1280x640) e logo.png (512x512, sfondo trasparente) dal logo.svg e da social.html.
// Uso (dalla cartella con logo.svg, social.html e node_modules/@fontsource/open-sans):
//   node shoot-social.js social-preview.png logo.png      Serve: npm i playwright @fontsource/open-sans
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();
let p=await b.newPage({viewport:{width:1280,height:640}});await p.goto('file://'+process.cwd()+'/social.html');await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:process.argv[2]});
p=await b.newPage({viewport:{width:512,height:512}});await p.setContent('<style>html,body{margin:0;background:transparent}</style><img src="file://'+process.cwd()+'/logo.svg" width=512 height=512>');await p.goto('file://'+process.cwd()+'/logo.svg');await p.screenshot({path:process.argv[3],omitBackground:true});await b.close()})()
