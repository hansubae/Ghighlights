import React, { useState, useEffect, useRef, useCallback } from 'react';

const AutocompleteInput = ({ suggestions, value, onChange, placeholder, id, strict = false }) => {
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1); // 키보드 탐색을 위한 인덱스
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const isClickingSuggestion = useRef(false); // 제안 클릭 중인지 추적

  // value 또는 suggestions가 변경될 때 필터링된 제안 업데이트
  useEffect(() => {
    if (value) {
      const filtered = suggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(true);
      setHighlightedIndex(-1); // 필터링될 때 하이라이트 초기화
    } else {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    }
  }, [value, suggestions]);

  // 외부 클릭 감지 (제안 목록 숨기기)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (inputRef.current && !inputRef.current.contains(event.target) &&
          suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
        // Strict mode: if value is not in suggestions, clear it on outside click
        if (strict && value && !suggestions.includes(value)) {
          onChange('');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [value, suggestions, strict, onChange]);

  const handleInputChange = (e) => {
    onChange(e.target.value);
  };

  const selectSuggestion = useCallback((suggestion) => {
    onChange(suggestion);
    setShowSuggestions(false);
    inputRef.current.focus(); // 선택 후 다시 input에 포커스
    setHighlightedIndex(-1); // 하이라이트 초기화
  }, [onChange]);

  const handleInputFocus = () => {
    if (value) {
      const filtered = suggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(true);
    } else if (!value && suggestions.length > 0) {
      // 입력값이 비어있을 때 포커스되면 모든 제안을 보여줌
      setFilteredSuggestions(suggestions);
      setShowSuggestions(true);
    }
    setHighlightedIndex(-1); // 포커스될 때 하이라이트 초기화
  };

  const handleKeyDown = (e) => {
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault(); // 커서 이동 방지
        setHighlightedIndex(prevIndex =>
          (prevIndex + 1) % filteredSuggestions.length
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); // 커서 이동 방지
        setHighlightedIndex(prevIndex =>
          (prevIndex - 1 + filteredSuggestions.length) % filteredSuggestions.length
        );
      } else if (e.key === 'Enter') {
        e.preventDefault(); // 폼 제출 방지
        if (highlightedIndex !== -1) {
          selectSuggestion(filteredSuggestions[highlightedIndex]);
        } else if (filteredSuggestions.length > 0) {
          // 하이라이트된 것이 없으면 첫 번째 제안 선택
          selectSuggestion(filteredSuggestions[0]);
        } else {
          // 제안이 없으면 입력 필드 흐리게
          inputRef.current.blur();
        }
      } else if (e.key === 'Tab') {
        // Tab 키는 다음 필드로 이동해야 하므로, 제안 목록을 숨김
        setShowSuggestions(false);
        setHighlightedIndex(-1);
      }
    }
  };

  return (
    <div className="autocomplete-container">
      <input
        type="text"
        id={id}
        value={value}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={(e) => {
          // onMouseDown이 먼저 발생하도록 딜레이를 주지 않음
          // 외부 클릭 감지 useEffect가 blur 처리를 담당
          if (!isClickingSuggestion.current) {
            // 엄격 모드 처리 (외부 클릭 감지에서 이미 처리되지만, 혹시 모를 경우를 대비)
            if (strict && value && !suggestions.includes(value)) {
              onChange('');
            }
          }
          isClickingSuggestion.current = false; // 상태 초기화
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="autocomplete-input"
        ref={inputRef}
        autoComplete="off"
      />
      {showSuggestions && filteredSuggestions.length > 0 && (
        <ul className="suggestions-list" ref={suggestionsRef}>
          {filteredSuggestions.slice(0, 7).map((suggestion, index) => (
            <li
              key={index}
              className={index === highlightedIndex ? 'highlighted' : ''}
              onMouseDown={() => {
                isClickingSuggestion.current = true; // 클릭 중임을 표시
                selectSuggestion(suggestion);
              }}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AutocompleteInput;