# Extract window.SCHOOL / CLASS6 / CALENDAR from school-data.js is overkill;
# school.json is a hand-maintained mirror of the workbook facts for other tools.
import json, pathlib
r=pathlib.Path(__file__).resolve().parents[1]
school={
 "school":"ÉCOLE AZOBE","system":"AZOBE - EFEDI","year":"2026/2027","schoolDays":180,"firstWeekMonday":"2026-09-07",
 "sources":{"canonical":"School_Manager (Drive id 1V6D-5NIs1ArjXs7H2CJHgqW5kViKfi1Q)","workingCopy":"TRUE MANANGER.xlsx (Drive id 1nCn-kDxcTVGFSBPjAFPUBh8vc08tKLFW)","calendar":"Azobe Calendrier_scolaire_2026_2027 (2).xlsx (Drive id 1yOSzJxrD-0OjVk_KOek7YX6eNNF6L0z1)"},
 "classes":[{"name":"SIL","code":"SIL","enrolled":27},{"name":"CP","code":"CP","enrolled":17},{"name":"CE1","code":"CE1","enrolled":23},{"name":"CE2","code":"CE2","enrolled":27},{"name":"CM1","code":"CM1","enrolled":27},{"name":"CM2","code":"CM2","enrolled":26},{"name":"6ème","code":"6EME","enrolled":29},{"name":"5ème","code":"5EME","enrolled":22},{"name":"4ème","code":"4EME","enrolled":13},{"name":"3ème","code":"3EME","enrolled":15},{"name":"2nde","code":"2ND","enrolled":18}],
 "totalEnrolled":244,
 "workingCopyTotal":241,
 "terms":[{"name":"Term 1","start":"2026-09-07","end":"2026-12-11"},{"name":"Term 2","start":"2027-01-04","end":"2027-03-19"},{"name":"Term 3","start":"2027-04-05","end":"2027-06-25"}],
 "weeklyControlSubjectsPer20":["English Language","Mathematics","French Language","Science & Technology"],
 "dailyPerformanceAreasPer10":["Assignments","Class participation","Order","Discipline","Cleanliness","Respect","Obedience"],
 "rollMarks":{"P":"Present","A":"Absent","L":"Late","E":"Excused"},
 "cotes":{"A+":">=90%","A":">=75%","ECA/B":">=50%","NA":"<50%"},
 "termFrameworkPer280":{"C1 Languages":100,"C2 Maths & Sciences":60,"C3 Values":40,"C4 Autonomy":20,"C5 ICT":20,"C6 Sport & Arts":40},
 "monthlyCardPer180":"C1 French & English (1A+1B), C2 (2A+2B), C4 (4A), C5 (5A)",
 "overallRule":"70% academic average + 30% daily-performance average (rescaled /20)"
}
(r/"data"/"school.json").write_text(json.dumps(school,ensure_ascii=False,indent=1))
print("school.json written")
