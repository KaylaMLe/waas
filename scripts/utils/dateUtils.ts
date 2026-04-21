/** Add calendar months (handles month-length edge cases). */
export function addCalendarMonths(from: Date, months: number): Date {
	const d = new Date(from.getTime());
	const day = d.getDate();
	d.setMonth(d.getMonth() + months);
	if (d.getDate() < day) {
		d.setDate(0);
	}
	return d;
}
