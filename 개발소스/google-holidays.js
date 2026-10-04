export async function googleHolidays(year,config,fetcher=fetch) {
  if(!config.calendarApiKey)throw new Error('공휴일 자동 표시: config.js에 Google Calendar API 키를 추가하세요(배포안내 참고).');
  const id=config.holidayCalendarId || 'ko.south_korea#holiday@group.v.calendar.google.com';
  let token;const events=[];
  do{
    const p=new URLSearchParams({key:config.calendarApiKey,timeMin:`${year}-01-01T00:00:00+09:00`,timeMax:`${year+1}-01-01T00:00:00+09:00`,singleEvents:'true',maxResults:'2500',...(token?{pageToken:token}:{})});
    const r=await fetcher(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events?${p}`,{signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw new Error('구글 공휴일 캘린더를 불러오지 못했습니다. Calendar API와 API 키의 사이트 제한을 확인하세요.');
    const data=await r.json();events.push(...(data.items || []));token=data.nextPageToken;
  }while(token);
  // Calendar can include observances. Mark only explicitly classified public holidays.
  const holidays=events.filter(e=>e.start?.date && /공휴일|Public holiday|National holiday/i.test(e.description || '') && !/Observance|기념일|not a public holiday/i.test(e.description || '')).map(e=>({date:e.start.date,name:e.summary}));
  if(!holidays.length)throw new Error('구글 캘린더에서 공휴일로 구분된 정보를 찾지 못했습니다.');
  return holidays;
}
