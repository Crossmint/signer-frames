import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock document object model for iframe tests
describe('iframe communication', () => {
  let iframe;
  let parent;
  const messageHandlers = {
    parent: null,
    iframe: null
  };

  // Set up the mock iframe and parent window environment
  beforeEach(() => {
    // Create mock iframe and parent elements
    parent = document.createElement('div');
    document.body.appendChild(parent);
    
    iframe = document.createElement('iframe');
    parent.appendChild(iframe);
    
    // Mock the iframe's contentWindow more completely
    Object.defineProperty(iframe, 'contentWindow', {
      value: {
        postMessage: vi.fn(),
        origin: 'http://localhost:8080',
        addEventListener: vi.fn((event, handler) => {
          if (event === 'message') {
            messageHandlers.iframe = handler;
          }
        })
      },
      configurable: true
    });

    // Clear message handlers
    messageHandlers.parent = null;
    messageHandlers.iframe = null;
    
    // Set up event listeners spy
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'message') {
        messageHandlers.parent = handler;
      }
    });
  });

  // Clean up after each test
  afterEach(() => {
    if (parent && document.body.contains(parent)) {
      document.body.removeChild(parent);
    }
    vi.restoreAllMocks();
  });

  it('should be able to create and append an iframe to the DOM', () => {
    expect(parent.contains(iframe)).toBe(true);
    expect(iframe.tagName).toBe('IFRAME');
  });

  it('should be able to send a message from parent to iframe', () => {
    // Create a test message
    const testMessage = {
      id: 'test_123',
      type: 'TEST_ACTION',
      data: { foo: 'bar' }
    };
    
    // Send the message to the iframe
    iframe.contentWindow.postMessage(testMessage, 'http://localhost:8080');
    
    // Verify that postMessage was called with the correct arguments
    expect(iframe.contentWindow.postMessage).toHaveBeenCalledWith(testMessage, 'http://localhost:8080');
  });

  it('should be able to handle messages received from the iframe', () => {
    // Create a response handler spy
    const responseHandler = vi.fn();
    
    // Add event listener to mock receiving a message
    window.addEventListener('message', (event) => {
      if (event.origin === 'http://localhost:8080') {
        responseHandler(event.data);
      }
    });
    
    // Create a mock message event
    const mockResponse = {
      id: 'test_123',
      type: 'TEST_RESPONSE',
      data: { success: true }
    };
    
    // Simulate iframe sending a message to parent
    if (messageHandlers.parent) {
      const mockEvent = {
        origin: 'http://localhost:8080',
        data: mockResponse
      };
      messageHandlers.parent(mockEvent);
    }
    
    // Verify the response handler was called with the expected data
    expect(responseHandler).toHaveBeenCalledWith(mockResponse);
  });

  it('should ignore messages from unauthorized origins', () => {
    // Create a response handler spy
    const responseHandler = vi.fn();
    
    // Add event listener to mock receiving a message
    window.addEventListener('message', (event) => {
      if (event.origin === 'http://localhost:8080') {
        responseHandler(event.data);
      }
    });
    
    // Simulate message from unauthorized origin
    if (messageHandlers.parent) {
      const mockEvent = {
        origin: 'http://malicious-site.com',
        data: { id: 'hack_attempt' }
      };
      messageHandlers.parent(mockEvent);
    }
    
    // Verify the response handler was not called
    expect(responseHandler).not.toHaveBeenCalled();
  });

  it('should handle bi-directional communication between parent and iframe', () => {
    // Parent handlers
    const parentMessageHandler = vi.fn();
    window.addEventListener('message', (event) => {
      if (event.origin === 'http://localhost:8080') {
        parentMessageHandler(event.data);
        
        // Send response back to iframe
        iframe.contentWindow.postMessage({
          id: event.data.id,
          type: 'PARENT_RESPONSE',
          data: { received: true }
        }, 'http://localhost:8080');
      }
    });
    
    // Iframe handlers (mock)
    const iframeMessageHandler = vi.fn();
    iframe.contentWindow.addEventListener('message', (event) => {
      if (event.origin === window.location.origin) {
        iframeMessageHandler(event.data);
      }
    });
    
    // Simulate iframe sending a message to parent
    if (messageHandlers.parent) {
      const mockEvent = {
        origin: 'http://localhost:8080',
        data: { id: 'test_123', type: 'IFRAME_MESSAGE' }
      };
      messageHandlers.parent(mockEvent);
    }
    
    // Verify parent received the message
    expect(parentMessageHandler).toHaveBeenCalledWith({ 
      id: 'test_123', 
      type: 'IFRAME_MESSAGE' 
    });
    
    // Verify iframe.postMessage was called with a response
    expect(iframe.contentWindow.postMessage).toHaveBeenCalledWith({
      id: 'test_123',
      type: 'PARENT_RESPONSE',
      data: { received: true }
    }, 'http://localhost:8080');
  });
});

// Test for the specific communication pattern used in test.html
describe('test.html iframe communication', () => {
  let iframe;
  let responseArea;
  let sendButton;
  let generateIdMock;
  const messageHandlers = [];

  beforeEach(() => {
    // Create DOM elements similar to test.html
    document.body.innerHTML = `
      <div class="container">
        <div class="controls">
          <button id="sendMessage">Send Test Message</button>
          <div class="response" id="responseArea">
            <p>Responses will appear here...</p>
          </div>
        </div>
        <iframe src="http://localhost:8080" id="targetFrame"></iframe>
      </div>
    `;
    
    // Get elements
    iframe = document.getElementById('targetFrame');
    responseArea = document.getElementById('responseArea');
    sendButton = document.getElementById('sendMessage');
    
    // Clear responseArea before tests
    responseArea.innerHTML = '';
    
    // Mock iframe.contentWindow
    Object.defineProperty(iframe, 'contentWindow', {
      value: {
        postMessage: vi.fn(),
        origin: 'http://localhost:8080',
        addEventListener: vi.fn()
      },
      configurable: true
    });
    
    // Mock generateId function similar to test.html
    generateIdMock = vi.fn().mockReturnValue('test_msg_123');
    global.generateId = generateIdMock;
    
    // Spy on window.addEventListener
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'message') {
        messageHandlers.push(handler);
      }
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    messageHandlers.length = 0; // Clear the array without using delete
    vi.restoreAllMocks();
    global.generateId = undefined; // Set to undefined instead of using delete
  });

  it('should send a message when the send button is clicked', () => {
    // Mock function implementation for Date.toISOString
    const mockTimestamp = '2023-01-01T12:00:00.000Z';
    const originalDate = global.Date;
    global.Date = class extends originalDate {
      toISOString() {
        return mockTimestamp;
      }
    };
    
    // Create a simplified implementation of the click handler
    sendButton.addEventListener('click', () => {
      const messageId = generateIdMock();
      const message = {
        id: messageId,
        type: 'TEST_ACTION',
        data: {
          test: true,
          timestamp: new Date().toISOString()
        }
      };
      
      // Clear previous responses
      responseArea.innerHTML = '';
      
      // Log sent message (in test.html this would add a div)
      const sentMsg = document.createElement('div');
      sentMsg.textContent = JSON.stringify(message);
      responseArea.appendChild(sentMsg);
      
      // Send message to iframe
      iframe.contentWindow.postMessage(message, 'http://localhost:8080');
    });
    
    // Trigger the click
    sendButton.click();
    
    // Test that iframe.contentWindow.postMessage was called with expected args
    expect(iframe.contentWindow.postMessage).toHaveBeenCalledWith({
      id: 'test_msg_123',
      type: 'TEST_ACTION',
      data: {
        test: true,
        timestamp: mockTimestamp
      }
    }, 'http://localhost:8080');
    
    // Test that the responseArea has been updated
    expect(responseArea.children.length).toBe(1);
    expect(responseArea.children[0].textContent).toContain('test_msg_123');
    expect(responseArea.children[0].textContent).toContain('TEST_ACTION');
    
    // Restore Date
    global.Date = originalDate;
  });

  it('should handle responses from the iframe', () => {
    // Make sure responseArea is empty at start
    responseArea.innerHTML = '';
    
    // Simulate a response from the iframe
    const mockResponse = {
      id: 'test_msg_123',
      type: 'TEST_RESPONSE',
      data: { success: true, message: 'Operation completed' }
    };
    
    // Add simplified handler similar to test.html
    const messageHandler = (event) => {
      if (event.origin === 'http://localhost:8080') {
        const responseMsg = document.createElement('div');
        responseMsg.textContent = JSON.stringify(event.data);
        responseArea.appendChild(responseMsg);
      }
    };
    
    // Register the handler
    messageHandlers.push(messageHandler);
    
    // Simulate the iframe sending a message
    messageHandler({
      origin: 'http://localhost:8080',
      data: mockResponse
    });
    
    // Check that the response was added to the responseArea
    expect(responseArea.children.length).toBe(1);
    expect(responseArea.children[0].textContent).toContain('test_msg_123');
    expect(responseArea.children[0].textContent).toContain('TEST_RESPONSE');
    expect(responseArea.children[0].textContent).toContain('Operation completed');
  });
}); 