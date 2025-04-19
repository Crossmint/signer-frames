import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('HTML page rendering', () => {
  let document;
  let html;

  // Load the actual HTML file content before tests
  beforeEach(() => {
    // Read the test.html file
    html = fs.readFileSync(path.resolve(process.cwd(), 'test.html'), 'utf8');
    
    // Parse the HTML content
    document = new DOMParser().parseFromString(html, 'text/html');
  });

  afterEach(() => {
    // Clean up
    document = null;
    html = null;
  });

  it('should have the correct title', () => {
    const title = document.querySelector('title');
    expect(title.textContent).toBe('Iframe Test Page');
  });

  it('should have the necessary UI elements', () => {
    // Check for main containers
    expect(document.querySelector('.container')).not.toBeNull();
    
    // Check for controls
    const controls = document.querySelector('.controls');
    expect(controls).not.toBeNull();
    
    // Check for buttons
    const sendButton = document.getElementById('sendMessage');
    const sendCustomButton = document.getElementById('sendCustom');
    expect(sendButton).not.toBeNull();
    expect(sendButton.textContent.trim()).toBe('Send Test Message');
    expect(sendCustomButton).not.toBeNull();
    expect(sendCustomButton.textContent.trim()).toBe('Send Custom Message');
    
    // Check for response area
    const responseArea = document.getElementById('responseArea');
    expect(responseArea).not.toBeNull();
    expect(responseArea.classList.contains('response')).toBe(true);
    
    // Check for iframe
    const iframe = document.getElementById('targetFrame');
    expect(iframe).not.toBeNull();
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe.src).toBe('http://localhost:8080/');
  });

  it('should have the correct CSS styles', () => {
    // Get all style elements
    const styleElements = document.querySelectorAll('style');
    expect(styleElements.length).toBeGreaterThan(0);
    
    // Combine all style content
    const styles = Array.from(styleElements)
      .map(style => style.textContent)
      .join('\n');
    
    // Check for essential styling rules
    expect(styles).toContain('body');
    expect(styles).toContain('font-family');
    expect(styles).toContain('.container');
    expect(styles).toContain('.controls');
    expect(styles).toContain('.response');
    expect(styles).toContain('iframe');
  });

  it('should have JavaScript functions for message handling', () => {
    // Get all script elements
    const scriptElements = document.querySelectorAll('script');
    expect(scriptElements.length).toBeGreaterThan(0);
    
    // Combine all script content
    const scripts = Array.from(scriptElements)
      .map(script => script.textContent)
      .join('\n');
    
    // Check for essential JavaScript functions
    expect(scripts).toContain('generateId');
    expect(scripts).toContain('addMessage');
    expect(scripts).toContain('addEventListener');
    expect(scripts).toContain('postMessage');
  });

  it('should have a function to generate unique message IDs', () => {
    // Get all script elements and combine their content
    const scripts = Array.from(document.querySelectorAll('script'))
      .map(script => script.textContent)
      .join('\n');
    
    // Check for the generateId function definition
    expect(scripts).toMatch(/function\s+generateId\s*\(\s*\)\s*\{/);
    
    // Check that it returns a string with the expected format
    expect(scripts).toContain('return \'msg_\'');
  });

  it('should have event handlers for buttons', () => {
    // Get script content
    const scripts = Array.from(document.querySelectorAll('script'))
      .map(script => script.textContent)
      .join('\n');
    
    // Check for button event listeners
    expect(scripts).toContain('sendButton.addEventListener');
    expect(scripts).toContain('sendCustomButton.addEventListener');
    
    // Check for click handlers
    expect(scripts).toMatch(/sendButton\.addEventListener\s*\(\s*['"]click['"]/);
    expect(scripts).toMatch(/sendCustomButton\.addEventListener\s*\(\s*['"]click['"]/);
  });

  it('should have a window message event listener', () => {
    // Get script content
    const scripts = Array.from(document.querySelectorAll('script'))
      .map(script => script.textContent)
      .join('\n');
    
    // Check for window message event listener
    expect(scripts).toMatch(/window\.addEventListener\s*\(\s*['"]message['"]/);
    
    // Check for origin check in the event handler
    expect(scripts).toContain('event.origin ===');
  });
}); 