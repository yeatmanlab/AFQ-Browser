function stringifySubjectID(sid) {
	if (typeof sid === 'number') {
		return "s" + sid.toString();
	} else {
		return sid
	}
}
