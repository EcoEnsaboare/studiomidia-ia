import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeCampaignPosts,campaignCsv} from '../ai-plan.mjs';
test('calendar refresh preserves other posts and updates campaign without duplicates',()=>{
 const original=[{id:'manual',title:'Manual'},{id:'ai-c-i',title:'Old',status:'draft'}];
 const campaign={id:'c',items:[{id:'i',title:'New',date:'2026-11-05',caption:'Caption',imagePath:'private/image.png'}]};
 const once=mergeCampaignPosts(original,campaign),twice=mergeCampaignPosts(once,campaign);
 assert.equal(twice.length,2);assert.equal(twice[0].title,'Manual');assert.equal(twice[1].title,'New');assert.equal(twice[1].status,'draft');assert.equal(original[1].title,'Old');assert.deepEqual(once,twice);
});
test('CSV escapes captions and neutralizes spreadsheet formulas',()=>{
 const csv=campaignCsv({items:[{date:'2026-11-05',title:'=HYPERLINK("x")',caption:'Linha 1\nLinha "2"; fim',prompt:'@formula'}]});
 assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));assert.ok(csv.includes('Linha ""2""; fim'));assert.ok(csv.includes('"\'@formula"'));
});
