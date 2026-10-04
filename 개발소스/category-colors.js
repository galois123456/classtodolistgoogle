import { appColors } from './app-colors.js';
export const categoryColors = appColors.map(([key,label,paper,ink])=>[key,label,key==='black'?'#111827':ink,key==='black'?'#f8fafc':paper]);
const defaultKeys = ['blue','purple','green','orange','pink','teal','red','indigo','black','yellow','brown','gray'];
export function categoryColor(category, categories) {
 const fallback=defaultKeys[Math.max(0,categories.findIndex(c=>c.id===category?.id)) % defaultKeys.length];
 return categoryColors.find(([key])=>key===category?.color) || categoryColors.find(([key])=>key===fallback);
}
