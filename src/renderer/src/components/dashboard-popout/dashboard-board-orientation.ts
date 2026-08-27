/**
 * Which way the board's buckets run.
 *
 * Columns is the kanban reading: each state is a column, and you scan down one
 * to see everything in it. Rows turns each state into a full-width band, so
 * every working agent sits on one line and the whole fleet's state is legible
 * without scrolling four separate columns.
 *
 * Only the buckets rotate. A project's agents stay stacked inside their box
 * either way — that grouping is what makes a bucket readable, and laying those
 * out sideways too would just be the flat list again.
 */

export type DashboardBoardOrientation = 'columns' | 'rows'
