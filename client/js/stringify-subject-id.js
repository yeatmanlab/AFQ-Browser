function stringifySubjectID(sid) {
	if (typeof sid === 'number') {
		return "s" + d.subjectID.toString();
	} else {
		return sid
	}
}
