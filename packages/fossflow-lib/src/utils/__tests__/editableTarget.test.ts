import { isEditableEventTarget } from '../editableTarget';

describe('isEditableEventTarget', () => {
  it('flags form fields and contenteditable targets', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    const plain = document.createElement('div');

    expect(isEditableEventTarget(input)).toBe(true);
    expect(isEditableEventTarget(textarea)).toBe(true);
    expect(isEditableEventTarget(select)).toBe(true);
    expect(isEditableEventTarget(editable)).toBe(true);
    expect(isEditableEventTarget(plain)).toBe(false);
    expect(isEditableEventTarget(null)).toBe(false);
  });

  it('flags rich-text editor descendants', () => {
    const editor = document.createElement('div');
    editor.className = 'ql-editor';
    const child = document.createElement('span');
    editor.appendChild(child);

    expect(isEditableEventTarget(child)).toBe(true);
  });
});
