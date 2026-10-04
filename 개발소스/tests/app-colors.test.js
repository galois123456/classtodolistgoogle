import test from 'node:test';
import assert from 'node:assert/strict';
import {appColors} from '../app-colors.js';
import {categoryColors,categoryColor} from '../category-colors.js';
import {timetableColors,normalizeTemplate,localDay,weekDays} from '../timetable-model.js';
test('동일한 16색 순서와 기존 색상 유지',()=>{
 assert.deepEqual(appColors.map(c=>c[1]),['노랑','주황','분홍','빨강','파랑','하늘','민트','초록','연두','보라','남색','갈색','크림','흰색','회색','검정']);
 assert.deepEqual(categoryColors.map(c=>c[0]),timetableColors.map(c=>c[0]));
 assert.equal(categoryColor({id:'1'},[{id:'1'}])[0],'blue');
 assert.equal(normalizeTemplate({rows:[{id:'1',cells:{0:{color:'rose'}}}]}).rows[0].cells[0].color,'red');
});
test('현재 날짜는 어느 요일 시작에서도 같은 헤더에 해당',()=>{
 const now=new Date();for(const start of ['sunday','monday']) assert.equal(weekDays(now,start).filter(d=>d.date===localDay(now)).length,1);
});
