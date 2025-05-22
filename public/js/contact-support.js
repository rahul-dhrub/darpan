document.addEventListener('DOMContentLoaded', function() {
  // Handle file selection and list
  const attachmentsInput = document.getElementById('attachments');
  const fileList = document.getElementById('fileList');
  let selectedFiles = new Set();

  attachmentsInput.addEventListener('change', function (e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if (!selectedFiles.has(file.name)) {
        selectedFiles.add(file.name);
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
          <span class="file-name">${file.name}</span>
          <button type="button" class="remove-file" data-filename="${file.name}">
            <span class="material-icons">close</span>
          </button>
        `;
        fileList.appendChild(fileItem);
      }
    });
  });

  // Handle file removal
  fileList.addEventListener('click', function (e) {
    if (e.target.closest('.remove-file')) {
      const button = e.target.closest('.remove-file');
      const filename = button.dataset.filename;
      selectedFiles.delete(filename);
      button.closest('.file-item').remove();

      // Create a new FileList without the removed file
      const dt = new DataTransfer();
      Array.from(attachmentsInput.files)
        .filter(file => file.name !== filename)
        .forEach(file => dt.items.add(file));
      attachmentsInput.files = dt.files;
    }
  });

  document.getElementById('supportForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const messageDiv = document.getElementById('formMessage');
    messageDiv.textContent = '';
    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      if (result.success) {
        messageDiv.textContent = 'Your message has been sent!';
        messageDiv.className = 'success-message';
        form.reset();
      } else {
        messageDiv.textContent = result.error || 'Failed to send message.';
        messageDiv.className = 'error-message';
      }
    } catch (err) {
      messageDiv.textContent = 'An error occurred. Please try again later.';
      messageDiv.className = 'error-message';
    }
  });
}); 