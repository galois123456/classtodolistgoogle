import test from 'node:test';
import assert from 'node:assert/strict';
import { weekDays, detailKey, normalizeTemplate, findRoomProfile, timetableColors } from '../timetable-model.js';
test('주 시작 순서와 연말·윤년 주 날짜',()=>{
 const monday=weekDays(new Date(2027,0,1),'monday'), sunday=weekDays(new Date(2027,0,1),'sunday');
 assert.equal(monday[0].date,'2026-12-28');assert.equal(monday[6].date,'2027-01-03');assert.equal(sunday[0].date,'2026-12-27');
 assert.equal(weekDays(new Date(2028,1,29),'monday')[1].date,'2028-02-29');
});
test('고정 시간표는 요일로 유지하고 세부사항은 날짜와 행으로 구분',()=>{
 const rows=[{id:'row',label:'점심',cells:{2:{subject:'수학',room:'3-1',color:'pink'}}}];
 const template=normalizeTemplate({rows});const first=weekDays(new Date(2026,9,6),'monday')[1], next=weekDays(new Date(2026,9,13),'sunday')[2];
 assert.equal(template.rows[0].cells[first.weekday].subject,template.rows[0].cells[next.weekday].subject);
 assert.notEqual(detailKey('row',first.date),detailKey('row',next.date));
 assert.notEqual(detailKey('row',first.date),detailKey('other',first.date));
 assert.equal(normalizeTemplate({rows:[{id:'x',cells:{0:{color:'url(bad)'}}}]}).rows[0].cells[0].color,'white');
});

test('반 이름이 정확히 일치할 때만 과목·색상을 자동 채움',()=>{
 const rows=[{cells:{0:{room:'3-1',subject:'수학',color:'orange'},1:{room:'3-2',subject:'기하',color:'purple'}}}];
 assert.deepEqual(findRoomProfile(rows,' 3-1 '),{subject:'수학',color:'orange'});
 assert.equal(findRoomProfile(rows,'3'),null);assert.equal(findRoomProfile(rows,''),null);
 assert.equal(timetableColors.length,16);assert.equal(new Set(timetableColors.map(c=>c[2])).size,16);
});

test('평일 시간표는 월요일부터 금요일만 보여주며 주말 설정은 유지',()=>{
 const days=weekDays(new Date(2026,9,3),'weekdays');
 assert.deepEqual(days.map(d=>d.weekday),[1,2,3,4,5]);
 assert.equal(days[0].date,'2026-09-28');assert.equal(days[4].date,'2026-10-02');
 const saved=normalizeTemplate({rows:[{id:'row',cells:{0:{subject:'주말 일정',color:'yellow'},6:{subject:'토요일',color:'blue'}}}]});
 assert.equal(saved.rows[0].cells[0].subject,'주말 일정');assert.equal(saved.rows[0].cells[6].subject,'토요일');
 assert.equal(weekDays(new Date(2026,9,3),'sunday').length,7);
});
