import { fireEvent, render, screen } from '@testing-library/preact';

import { EventNotesField } from '@/components/common/EventNotesField';
import { LocaleProvider } from '@/locale';

const renderNotes = (value: string, onChange = vi.fn()) =>
  render(
    <LocaleProvider locale='en-US'>
      <div className='df-event-detail-panel'>
        <EventNotesField
          id='note'
          value={value}
          editable
          disabled={false}
          rows={3}
          onChange={onChange}
        />
      </div>
    </LocaleProvider>
  );

describe('EventNotesField', () => {
  it('renders mixed Outlook notes as readable links and dividers', () => {
    const notes =
      '__________\nMicrosoft Teams meeting\nJoin: https://teams.microsoft.com/meet/436605223744481?p=abc\nNeed help?<https://aka.ms/JoinTeamsMeeting?omkt=en-AU>\n__________\nConfidential note';
    const { container } = renderNotes(notes);

    expect(container.querySelectorAll('hr')).toHaveLength(2);
    expect(container.querySelectorAll('a')).toHaveLength(2);
    expect(screen.getByText('Confidential note')).toBeTruthy();
  });

  it('renders HTML safely and edits a readable text projection', () => {
    const notes =
      'Join: https://meet.google.com/zfc-scqu-jrz\n<a href="https://example.com/reschedule">Reschedule</a>';
    const onChange = vi.fn();
    renderNotes(notes, onChange);

    expect(
      screen.getByText('Reschedule').closest('a')?.getAttribute('href')
    ).toBe('https://example.com/reschedule');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Event' }));
    const readable =
      'Join: https://meet.google.com/zfc-scqu-jrz\nReschedule <https://example.com/reschedule>';
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      readable
    );
    fireEvent.input(screen.getByRole('textbox'), {
      target: { value: `${readable}\nAgenda` },
    });
    expect(onChange).toHaveBeenCalledWith(`${readable}\nAgenda`);
  });

  it('formats line breaks, emphasis and lists without exposing markup', () => {
    const notes =
      'Itinerary: Jayce L<br /><strong>Interview Information</strong><ul><li>Google Meet</li><li><em>Hiring Manager Interview</em></li></ul><script>alert(1)</script>';
    const { container } = renderNotes(notes);

    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('strong')?.textContent).toBe(
      'Interview Information'
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).not.toContain('<br');
    expect(container.textContent).not.toContain('alert(1)');
  });
});
