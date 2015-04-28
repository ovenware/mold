'use strict';

angular.module('Mold')
.factory('moldRenderer',[
function() {
  /**
   * renderer factory
   * @param {Function} getParameterFunction
   * @param {Function} getHeirFunction
   */
  function Renderer(getParameterFunction, getHeirFunction) {
    this.getHeir = getHeirFunction;
    this.getParameter = getParameterFunction;
  }
  (function() {
    this.render = function(scope, source, require) {
      var renderType = scope.$renderType
        , type = scope.$unitType
        , parameters = this.getParameter(type, renderType, require)
        , count = 1
        , that = this
        ;

      if (parameters.length) {
        scope.$watch(source, function(nv, ov) {
          var parameter
            , i = 0
            , value
            ;

          for (; (parameter = parameters[i]); i++) {
            value = nv[parameter];

            if (count || !ov || !angular.equals(value, ov[parameter])) {
              that.filterParameterValue(scope, source, parameter, value);
            }
          }
          count = 0;
        }, true);
      }
    };
    // 过滤变化值
    this.filterParameterValue = function(scope, source, parameter, value) {

      if (source === '$cMold') {
        // 数据来自component
        // 自身属性存在, 无视component上属性变化
        if (typeof scope.$mold[parameter] !== 'undefined') {
          return;
        }
      } else {
        // 数据来自自身, 值为空或者undefined
        // component属性不为空时, 使用component的值
        if ((value === '' || typeof value === 'undefined') &&
            typeof scope.$cMold[parameter] !== 'undefined') {
          value = scope.$cMold[parameter];
        }
      }
      this.handleParameterChange(scope, parameter, value);
    };
    this.setInherits = function(scope, parameter, value) {

      if (typeof value === 'undefined' || value === '') {
        delete scope[parameter];
      } else {
        // 设置属性以供继承
        if (scope.$unitType !== 'background') {
          scope[parameter] = value;
        }
      }
    };
    this.handleParameterChange = function(scope, parameter, value) {
      this.setInherits(scope, parameter, value);
      this.setAttr(scope, parameter, value);
    };
    this.setAttr = function(scope, attr, value) {
      var node = scope.$node;

      if (typeof value === 'undefined' || value === '') {
        node.removeAttribute(attr);
      } else {
        node.setAttribute(attr, value);
      }
    };
  }).apply(Renderer.prototype);

  return {
    create: function(getParameterFunction, getHeirFunction) {
      return new Renderer(getParameterFunction, getHeirFunction);
    }
  };
}]);
