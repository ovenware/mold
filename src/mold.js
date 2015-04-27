'use strict';

angular.module('Mold', [])
.factory('mold', [
'$compile',
'$animate',
function ($compile, $animate) {
  /**
   * Mold constructor
   * @param {String} name        directive's name
   * @param {Object} data        data factory
   * @param {Object} render      render factory
   * @param {Object} step        step factory
   * @param {Object} interaction interaction factory
   */
  function Mold(name, data, render, step, interaction) {
    this.name = name;
    this.dataFactory = data;
    this.renderFactory = render;
    this.stepFactory = step;
    this.interactionFactory = interaction;
    this.uid = 0;
  }
  (function() {
    this.init = function (scope, element) {
      var that = this;

      // 为避免被子scope继承，辅助属性不管使用与否都必须创建
      scope.$$child = {}; // child scopes
      scope.$$comment = {}; // comment elements

      scope.$moldName = this.name;
      scope.$node = element[0];
      scope.$unitType = null;
      scope.$childMold = {};
      scope.$dUnits = {};
      scope.$cMold = {};
      scope.$referenceWatch = {};

      // 非动态子节点或者组件子节点
      if (scope.$mold.id && !scope.$dynamicMold && !scope.$componentChild) {
        element.attr('id', this.name + '-' + scope.$mold.id);
      }

      this.dataFactory.get(scope.$mold.cid, scope).then(function (c) {
        that._init(scope, c);
      });

      scope.$on('$destroy', function() {
        var watcherSet = scope.$referenceWatch
          , watcher
          , set
          ;

        for (set in watcherSet) {
          watcher = watcherSet[set];

          if (watcher) {
            watcher.forEach(function(w) {
              if (w && typeof w === 'function') {
                w();
              }
            });
          }
        }
      });
    };
    this._init = function(scope, component) {
      var that = this
        , source = '$mold'
        , className
        ;

      // 如果是组件
      if (component) {
        className = 'component';
        scope.$cMold = component;
        scope.$unitType = component.unitType;
        // 渲染源数据上与compnent相关的参数
        if (this.renderFactory) {
          this.renderFactory.render(scope, source, component.require);
        }
        source = '$cMold';
      } else {
        scope.$unitType = scope.$mold.unitType || 'g';
        className = scope.$unitType;
      }

      angular.element(scope.$node).addClass(this.name + '-' + className);

      if (this.stepFactory) {
        this.stepFactory.check(scope, 'init');

        scope.$watchCollection(source + '.heir', function() {
          that.stepFactory.check(scope, 'heirChanged');
        });
      }

      // 渲染源数据/componet上与unitType相关的参数
      if (this.renderFactory) {
        this.renderFactory.render(scope, source);
      }

      // 处理行为
      if (this.interactionFactory) {
        this.interactionFactory.bind(scope);
      }

      // 开始构建子节点
      this.renderHeir(scope, source);
    };
    this.hashKey = function (obj) {
      var objType = typeof obj
        , key
        ;

      if (objType === 'object' && obj !== null) {
        key = obj.uid = ++this.uid;
      } else {
        key = obj;
      }
      return objType + ':' + key;
    };
    this.createHeir = function (scope, i, heirArray, nextBlockMap, nextBlockArray, type, previousNode) {
      var that = this
        , block = nextBlockArray[i]
        , childScope = scope.$new()
        ;

      this.dataFactory.get(heirArray[i], scope).then(function(unit) {
        // 尝试获取component数据
        that.dataFactory.get(unit.cid, scope).then(function(component) {
          var unitType
            , path
            , childNode
            ;

          if (component) {
            unitType = component.unitType;
            path = component.name;
          } else {
            unitType = unit.unitType;
            path = unit.name;
          }
          unitType = unitType || 'g';

          childNode = that.renderFactory.create(unitType);
          childNode.setAttribute(scope.$moldName, '');

          // 自身没有id，认为其是动态创建的子元素
          if (!unit.id) {
            childScope.$dynamicMold = true;
          } else if (scope.$cMold.id && scope.$cMold.id === unit.id) {
            childScope.$componentChild = true;
          }

          childScope.$mold = unit;

          $compile(childNode)(childScope, function(node, iscope){
            $animate.enter(node, null, previousNode);

            block.node = node;
            block.scope = iscope;
            nextBlockMap[block.id] = block;

            // next
            that.nextChild(scope, i + 1, heirArray, nextBlockMap, nextBlockArray, type, node);
          });
        });
      });
      return childScope;
    };
    // 处理子节点
    this.nextChild = function (scope, i, heirArray, nextBlockMap, nextBlockArray, type, previousNode) {
      var that = this
        , block = nextBlockArray[i]
        , childScope
        ;

      if (block) {

        if (block.scope) {
          // 处理已有block
          childScope = block.scope;
          $animate.move(block.node, null, previousNode);
          // next
          that.nextChild(scope, i + 1, heirArray, nextBlockMap, nextBlockArray, type, block.node);
        } else {
          // 为新block创建scope和node
          childScope = this.createHeir(scope, i, heirArray, nextBlockMap, nextBlockArray, type, previousNode);
        }
        scope.$childMold[type].push(childScope);
        // childScope.$index = i;
      } else {
        scope.$$child[type] = nextBlockMap;
        this.ready(scope);
      }
    };
    this.handleHeir = function (scope, heirArray, type) {
      var nextBlockMap = {}
        , nextBlockArray = []
        , key
        , i
        , item
        , trackId
        , block
        ;

      if (!heirArray) {
        this.ready(scope);
        return;
      }

      // 找到已有节点
      for (i = 0; (item = heirArray[i]); i++) {
        trackId = this.hashKey(item);

        if (scope.$$child[type].hasOwnProperty(trackId)) {
          // 已有 block
          // 保存到nextBlockArray
          block = scope.$$child[type][trackId];
          delete scope.$$child[type][trackId];

          nextBlockArray[i] = block;
          nextBlockMap[trackId] = block;
        } else {
          // new block
          nextBlockArray[i] = {id: trackId};
          nextBlockMap[trackId] = false;
        }
      }

      // 清理scope.$$child中剩下（已不存在）的节点
      for (key in scope.$$child[type]) {

        if (scope.$$child[type].hasOwnProperty(key)) {
          block = scope.$$child[type][key];
          $animate.leave(block.node);
          block.node.MD_REMOVED = true;
          block.scope.$destroy();
        }
      }

      // 处理子节点
      // 考虑到数据可能在远端，需要异步执行
      // 为避免顺序混乱，在这里做单步顺序执行处理
      scope.$childMold[type] = [];
      this.nextChild(scope, 0, heirArray, nextBlockMap, nextBlockArray, type, scope.$$comment[type]);
    };
    // 开始构建子节点
    this.renderHeir = function (scope, source) {
      var i = 0
        , unitType = scope[source].unitType
        , listArray = this.renderFactory.getHeir(unitType)
        , type
        ;

      if (listArray) {
        for (; (type = listArray[i]); i++) {
          if (type === 'require' && !scope[source].require) {
            continue;
          } else {
            this.watchHeir(scope, type, source);
          }
        }
      } else {
        this.ready(scope);
      }
    };
    this.watchHeir = function (scope, type, source) {
      var that = this
        , comment = document.createComment(type + ' begin')
        , target = type === 'base' ? source + '.heir' : '$dUnits.' + type
        ;

      scope.$$child[type] = {};
      scope.$$comment[type] = angular.element(comment);
      scope.$node.appendChild(comment);
      scope.$watchCollection(target, function(nv) {
        that.handleHeir(scope, nv, type);
      });
    };
    this.ready = function(scope) {
      // 使用timeout解决时序问题
      if (scope.$moldName === 'editor-mold') {
        setTimeout(function() {
          scope.$emit('MOLD_READY');
        }, 0);
      }
    };
  }).apply(Mold.prototype);

  return {
    create: function(name, data, render, step, interaction) {
      return new Mold(name, data, render, step, interaction);
    }
  };
}]);
